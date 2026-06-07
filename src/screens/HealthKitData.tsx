import React, { useEffect, useRef } from 'react';
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
import { useUser } from '../context/UserContext';
import { useHealthKitDataScreen } from '../hooks/useHealthKitDataScreen';
import type { HealthKitDataScreenRow, HealthKitDataScreenRowKind } from '../types';
import { reportErrorToSentry } from '../utils/observability';
import {
  FLOATING_TAB_BAR_EXTRA,
  SCREEN_PADDING_TOP_EXTRA,
  SCREEN_SCROLL_PADDING_BOTTOM_EXTRA,
} from '../constants/floatingTabBar';
import { theme } from '../theme/colors';

function kindColor(kind: HealthKitDataScreenRowKind): string {
  switch (kind) {
    case 'error':
      return theme.errorText;
    case 'permission':
      return '#E8A87C';
    case 'no_data':
      return theme.textMuted;
    case 'unavailable':
      return theme.textMuted;
    case 'value':
      return theme.text;
    case 'info':
    default:
      return theme.textSecondary;
  }
}

function RowCard({ row }: { row: HealthKitDataScreenRow }) {
  const color = kindColor(row.kind);
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{row.label}</Text>
      <Text style={[styles.cardText, { color }]}>{row.text}</Text>
      {row.hint ? <Text style={styles.cardHint}>{row.hint}</Text> : null}
    </View>
  );
}

export default function HealthKitData() {
  const insets = useSafeAreaInsets();
  const posthog = usePostHog();
  const { user } = useUser();
  const { data, loading, error, refreshing, refresh } = useHealthKitDataScreen();
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    posthog?.capture('healthkit_data_screen_viewed', { user });
  }, [posthog, user]);

  useEffect(() => {
    if (!error) return;
    reportErrorToSentry(error, {
      domain: 'healthkit_data_screen',
      operation: 'useCache_fetch',
      user,
    });
  }, [error, user]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: SCREEN_PADDING_TOP_EXTRA + insets.top,
          paddingBottom:
            SCREEN_SCROLL_PADDING_BOTTOM_EXTRA + insets.bottom + FLOATING_TAB_BAR_EXTRA,
        },
      ]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <Text style={styles.title}>Salud (HealthKit)</Text>
      <Text style={styles.subtitle}>
        Valores leídos en el dispositivo. «Sin datos en Salud» no es un fallo: indica que no hay
        muestras. Los errores de lectura se envían a Sentry cuando no son esperables (p. ej.
        permisos pendientes no cuentan).
      </Text>

      {loading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#C97B6E" />
          <Text style={styles.loadingText}>Leyendo Salud…</Text>
        </View>
      ) : null}

      {error && !data ? (
        <View style={styles.card}>
          <Text style={[styles.cardText, { color: theme.errorText }]}>
            No se pudo cargar la vista. Tirá hacia abajo para reintentar.
          </Text>
        </View>
      ) : null}

      {data?.rows.map((row) => (
        <RowCard key={row.id} row={row} />
      ))}

      {data ? (
        <Text style={styles.footer}>
          Actualizado: {new Date(data.refreshedAt).toLocaleString('es-ES')}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingBottom: SCREEN_SCROLL_PADDING_BOTTOM_EXTRA, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginBottom: 8 },
  centered: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  loadingText: { color: theme.textMuted, fontSize: 14 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardLabel: { fontSize: 12, fontWeight: '600', color: theme.textMuted, marginBottom: 6 },
  cardText: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  cardHint: { fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 18 },
  footer: { fontSize: 12, color: theme.textMuted, marginTop: 8 },
});
