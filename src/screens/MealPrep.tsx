import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePostHog } from 'posthog-react-native';
import { getMealPrep, listNotionBlockChildrenPage } from '../api/notion';
import { useUser } from '../context/UserContext';
import { useCache } from '../hooks/useCache';
import {
  expandMealPrepNotionBlocks,
  getTodayMeals,
  type NotionBlock,
} from '../utils/mealPrepParser';
import { reportErrorToSentry } from '../utils/observability';
import { FLOATING_TAB_BAR_EXTRA } from '../constants/floatingTabBar';

type MealPrepCacheData = {
  weekTitle: string | null;
  today: ReturnType<typeof getTodayMeals>;
};

export default function MealPrep() {
  const insets = useSafeAreaInsets();
  const posthog = usePostHog();
  const { user } = useUser();

  const loadMealPrep = useCallback(async (): Promise<MealPrepCacheData> => {
    try {
      const prep = await getMealPrep();

      if (!prep) {
        posthog?.capture('meal_prep_loaded', {
          user,
          has_week_plan: false,
          has_today_meals: false,
          meals_count: 0,
        });
        return { weekTitle: null, today: null };
      }

      const expanded = await expandMealPrepNotionBlocks(
        prep.blocks as NotionBlock[],
        (blockId, pageSize) => listNotionBlockChildrenPage(blockId, pageSize)
      );

      const todayMeals = getTodayMeals(expanded, user);
      posthog?.capture('meal_prep_loaded', {
        user,
        has_week_plan: true,
        has_today_meals: Boolean(todayMeals),
        meals_count: todayMeals?.meals.length ?? 0,
        top_level_block_count: prep.blocks.length,
        expanded_block_count: expanded.length,
      });
      return { weekTitle: prep.title, today: todayMeals };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      reportErrorToSentry(e, {
        domain: 'notion',
        message,
        user,
      });
      throw e instanceof Error ? e : new Error(message);
    }
  }, [user, posthog]);

  const { data, loading, error, refreshing, refresh } = useCache(
    `meal_prep_${user}`,
    loadMealPrep,
    30 * 60 * 1000
  );

  const weekTitle = data?.weekTitle ?? null;
  const today = data?.today ?? null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: 12 + insets.top,
          paddingBottom: 32 + insets.bottom + FLOATING_TAB_BAR_EXTRA,
        },
      ]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error.message}</Text>
        </View>
      )}

      {loading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#222" />
          <Text style={styles.loadingText}>Cargando plan…</Text>
        </View>
      ) : error && !data ? null : !weekTitle ? (
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
