import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useCalendarDayLocal } from '../hooks/useSelectableLogDate';
import { useChores, type ChoreItem } from '../hooks/useChores';
import { getNotionSettingsSource } from '../config/notionSettings';
import { getProfileLabel } from '../config/profiles';
import { FREQUENCY_LABEL } from '../utils/choreSchedule';
import { ErrorBanner } from '../components/ErrorBanner';
import { LoadingRow } from '../components/LoadingRow';
import { EmptyState } from '../components/EmptyState';
import {
  FLOATING_TAB_BAR_EXTRA,
  SCREEN_PADDING_TOP_EXTRA,
  SCREEN_SCROLL_PADDING_BOTTOM_EXTRA,
} from '../constants/floatingTabBar';
import { theme } from '../theme/colors';

function metaLine(c: ChoreItem): string {
  const parts: string[] = [];
  if (c.status.doneToday) {
    parts.push(c.doneBy ? `Hecha por ${c.doneBy}` : 'Hecha hoy');
  } else if (c.status.overdueDays > 0) {
    parts.push(`Atrasada ${c.status.overdueDays} ${c.status.overdueDays === 1 ? 'día' : 'días'}`);
  }
  parts.push(
    c.frequency === 'cada_n_dias' && c.everyNDays
      ? `Cada ${c.everyNDays} días`
      : FREQUENCY_LABEL[c.frequency],
  );
  return parts.join(' · ');
}

/** Tareas del hogar del día: para ti, para cualquiera y (plegado) de otras personas. */
export default function Chores() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const todayISO = useCalendarDayLocal();
  const { groups, pendingForMe, loading, error, hasDb, discovering, discover, toggle, refetch } =
    useChores(user, todayISO);
  const [othersOpen, setOthersOpen] = React.useState(false);

  const onToggle = React.useCallback(
    (c: ChoreItem) => {
      toggle(c).catch(() =>
        Alert.alert('No se guardó', 'Revisa tu conexión a internet e inténtalo otra vez.'),
      );
    },
    [toggle],
  );

  const onDiscover = React.useCallback(() => {
    void discover().then((found) => {
      if (!found) {
        Alert.alert(
          'No encontré la base',
          'Crea en Notion una base llamada «Tareas del hogar» y conéctala a tu integración (··· → Conexiones). Luego vuelve a intentar.',
        );
      }
    });
  }, [discover]);

  const renderList = (items: ChoreItem[]) => (
    <View style={styles.card}>
      {items.map((c, i) => (
        <TouchableOpacity
          key={c.notion_id}
          style={[styles.row, i < items.length - 1 && styles.rowBorder]}
          onPress={() => onToggle(c)}
          activeOpacity={0.65}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: c.status.doneToday }}
          accessibilityLabel={`${c.name}. ${metaLine(c)}`}
        >
          <View style={[styles.checkbox, c.status.doneToday && styles.checkboxDone]}>
            {c.status.doneToday ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.name, c.status.doneToday && styles.nameDone]}>{c.name}</Text>
            <Text
              style={[
                styles.meta,
                !c.status.doneToday && c.status.overdueDays > 0 && styles.metaOverdue,
              ]}
            >
              {metaLine(c)}
            </Text>
            {c.notes ? <Text style={styles.notes}>{c.notes}</Text> : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const nothingToday =
    !loading &&
    !error &&
    hasDb &&
    groups.mine.length + groups.shared.length + groups.others.length === 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: SCREEN_PADDING_TOP_EXTRA + insets.top,
          paddingBottom:
            SCREEN_SCROLL_PADDING_BOTTOM_EXTRA + insets.bottom + FLOATING_TAB_BAR_EXTRA,
        },
      ]}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refetch()} />}
      {...(Platform.OS === 'ios' ? ({ contentInsetAdjustmentBehavior: 'never' } as const) : {})}
    >
      <Text style={styles.title}>Casa</Text>
      <Text style={styles.subtitle}>
        {hasDb && !loading
          ? pendingForMe === 0
            ? 'Nada pendiente para ti hoy.'
            : `Te ${pendingForMe === 1 ? 'falta' : 'faltan'} ${pendingForMe} ${pendingForMe === 1 ? 'tarea' : 'tareas'} hoy.`
          : 'Tareas del hogar del día.'}
      </Text>

      {error && <ErrorBanner message={`No se pudieron cargar las tareas:\n${error.message}`} />}
      {loading && !error && <LoadingRow />}

      {!loading && !hasDb && (
        <View style={styles.setupCard}>
          <Text style={styles.setupTitle}>Conecta tu lista de tareas</Text>
          <Text style={styles.setupText}>
            En Notion, crea (o duplica del template) una base «Tareas del hogar» con Tarea,
            Frecuencia, Persona y Última vez, y conéctala a tu integración.
          </Text>
          {getNotionSettingsSource() === 'stored' && (
            <TouchableOpacity
              style={styles.setupBtn}
              onPress={onDiscover}
              disabled={discovering}
              accessibilityRole="button"
            >
              <Text style={styles.setupBtnText}>
                {discovering ? 'Buscando…' : 'Buscar mi base de tareas'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {nothingToday && <EmptyState message="Hoy no toca ninguna tarea de casa." />}

      {groups.mine.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Para ti ({getProfileLabel(user)})</Text>
          {renderList(groups.mine)}
        </View>
      )}

      {groups.shared.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Para cualquiera</Text>
          {renderList(groups.shared)}
        </View>
      )}

      {groups.others.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setOthersOpen((v) => !v)}
            style={styles.othersToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: othersOpen }}
          >
            <Text style={styles.sectionLabel}>
              {othersOpen ? '▾' : '▸'} De otras personas ({groups.others.length})
            </Text>
          </TouchableOpacity>
          {othersOpen && (
            <>
              <Text style={styles.othersHint}>
                Puedes marcarlas si las hiciste tú; quedan como hechas para todo el hogar.
              </Text>
              {renderList(groups.others)}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: 20, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: theme.text },
  subtitle: { fontSize: 15, color: theme.textSecondary, marginTop: -6 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: theme.text },
  othersToggle: { paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  othersHint: { fontSize: 13, color: theme.textSecondary, lineHeight: 18 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.rowDivider },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { borderColor: theme.accent, backgroundColor: theme.accent },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  textCol: { flex: 1 },
  name: { fontSize: 17, fontWeight: '600', color: theme.text },
  nameDone: { textDecorationLine: 'line-through', color: theme.textMuted },
  meta: { fontSize: 14, color: theme.textMuted, marginTop: 3 },
  metaOverdue: { color: theme.warningText, fontWeight: '600' },
  notes: { fontSize: 13, color: theme.textSecondary, marginTop: 3, lineHeight: 18 },
  setupCard: {
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
  },
  setupTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
  setupText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  setupBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.accentSoft,
    minHeight: 44,
    justifyContent: 'center',
  },
  setupBtnText: { fontSize: 15, fontWeight: '600', color: theme.accent },
});
