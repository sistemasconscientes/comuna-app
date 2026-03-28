import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { usePostHog } from 'posthog-react-native';
import { NOTION_API_KEY } from '@env';
import { getMealPrep } from '../api/notion';
import { useUser } from '../context/UserContext';
import {
  expandMealPrepNotionBlocks,
  getTodayMeals,
  type NotionBlock,
} from '../utils/mealPrepParser';

export default function MealPrep() {
  const posthog = usePostHog();
  const { user } = useUser();
  const [weekTitle, setWeekTitle] = React.useState<string | null>(null);
  const [today, setToday] = React.useState<ReturnType<typeof getTodayMeals>>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const prep = await getMealPrep();
        if (cancelled) return;

        if (!prep) {
          setWeekTitle(null);
          setToday(null);
          posthog?.capture('meal_prep_loaded', {
            user,
            has_week_plan: false,
            has_today_meals: false,
            meals_count: 0,
          });
          return;
        }
        setWeekTitle(prep.title);

        // Las tablas de Notion no incluyen sus filas en el listado
        // de la página — hay que hacer fetch adicional por cada tabla.
        const expanded = await expandMealPrepNotionBlocks(
          prep.blocks as NotionBlock[],
          async (blockId: string, pageSize: number) => {
            const res = await fetch(
              `https://api.notion.com/v1/blocks/${blockId}/children?page_size=${pageSize}`,
              {
                headers: {
                  Authorization: `Bearer ${NOTION_API_KEY}`,
                  'Notion-Version': '2022-06-28',
                  'Content-Type': 'application/json',
                },
              }
            );
            const data = await res.json();
            return data.results ?? [];
          }
        );

        if (cancelled) return;
        const todayMeals = getTodayMeals(expanded);
        setToday(todayMeals);
        posthog?.capture('meal_prep_loaded', {
          user,
          has_week_plan: true,
          has_today_meals: Boolean(todayMeals),
          meals_count: todayMeals?.meals.length ?? 0,
          top_level_block_count: prep.blocks.length,
          expanded_block_count: expanded.length,
        });
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setError(message);
          setWeekTitle(null);
          setToday(null);
          posthog?.capture('notion_meal_prep_load_failed', {
            domain: 'notion',
            message,
            user,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, posthog]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#222" />
          <Text style={styles.loadingText}>Cargando plan…</Text>
        </View>
      ) : error ? null : !weekTitle ? (
        <Text style={styles.muted}>Sin plan de comidas en Notion</Text>
      ) : today ? (
        <>
          <Text style={styles.weekTitle}>{weekTitle}</Text>
          <Text style={styles.daySubtitle}>{today.dayLabel}</Text>
          <View style={styles.list}>
            {today.meals.map((m, idx) => (
              <View key={`${idx}-${m.tipo}`} style={styles.mealRow}>
                <Text style={styles.mealTipo}>{m.tipo}</Text>
                <Text style={styles.mealPlato}>{m.plato || '—'}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.weekTitle}>{weekTitle}</Text>
          <Text style={styles.emptyText}>No hay plan para hoy</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { padding: 20, gap: 12, paddingBottom: 32 },
  centered: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#888' },
  weekTitle: { fontSize: 20, fontWeight: '700', color: '#222' },
  daySubtitle: { fontSize: 16, fontWeight: '600', color: '#444', marginTop: 4 },
  muted: { fontSize: 15, color: '#888', fontStyle: 'italic' },
  emptyText: { fontSize: 15, color: '#aaa', fontStyle: 'italic', marginTop: 8 },
  list: { gap: 10, marginTop: 8 },
  mealRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  mealTipo: { fontSize: 13, color: '#888', textTransform: 'capitalize', marginBottom: 4 },
  mealPlato: { fontSize: 16, fontWeight: '500', color: '#222' },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  errorText: { color: '#C62828', fontSize: 13 },
});
