import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePostHog } from 'posthog-react-native';
import { useUser } from '../context/UserContext';
import { useHealthData } from '../hooks/useHealthData';
import { useSupplements } from '../hooks/useSupplements';
import { useDailyLog } from '../hooks/useDailyLog';
import { useSelectableLogDate, useCalendarDayLocal } from '../hooks/useSelectableLogDate';
import {
  FLOATING_TAB_BAR_EXTRA,
  SCREEN_PADDING_TOP_EXTRA,
  SCREEN_SCROLL_PADDING_BOTTOM_EXTRA,
} from '../constants/floatingTabBar';
import { theme } from '../theme/colors';

const PHASE_COLORS: Record<string, string> = {
  menstrual: '#E57373',
  folicular: '#81C784',
  ovulacion: '#FFD54F',
  lutea: '#BA68C8',
};

type Props = {
  onBack: () => void;
};

export default function DailyLogByDate({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const posthog = usePostHog();
  const { user } = useUser();
  const calendarDayKey = useCalendarDayLocal();
  const { dateISO, formattedLabel, goPrevDay, goNextDay, setToday, isAtToday } =
    useSelectableLogDate();
  const { cyclePhase, loading: healthLoading, error: healthError } = useHealthData(user, {
    calendarDayKey,
  });
  const {
    supplements,
    idByNotionId,
    loading: supplementsLoading,
    error: supplementsError,
  } = useSupplements(user, cyclePhase ?? '', { calendarDayKey });
  const { isTaken, markTaken, loading: logLoading, error: logError } = useDailyLog(user, dateISO);

  React.useEffect(() => {
    posthog?.capture('daily_log_history_opened', { user });
  }, [posthog, user]);

  const phaseColor = cyclePhase ? PHASE_COLORS[cyclePhase] : '#ccc';

  const takenCount = supplements.reduce((count, s) => {
    const localId = idByNotionId[s.notion_id];
    if (!localId) return count;
    return count + (isTaken(localId) ? 1 : 0);
  }, 0);

  const dataLoading = healthLoading || supplementsLoading || logLoading;
  const fetchError = healthError ?? supplementsError ?? logError;
  const showEmptySupplements =
    !dataLoading && !fetchError && supplements.length === 0;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.topBar, { paddingTop: SCREEN_PADDING_TOP_EXTRA + insets.top }]}>
        <View style={styles.topBarSide}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backLabel}>‹ Volver</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.topTitle}>Mis tomas</Text>
        <View style={styles.topBarSide} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              SCREEN_SCROLL_PADDING_BOTTOM_EXTRA + insets.bottom + FLOATING_TAB_BAR_EXTRA,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {fetchError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              Error al cargar datos:{'\n'}
              {fetchError.message}
            </Text>
          </View>
        )}

        {dataLoading && !fetchError && (
          <View style={styles.loadingRow} accessibilityLabel="Cargando datos">
            <ActivityIndicator size="small" color="#888" />
            <Text style={styles.muted}>Cargando datos…</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>Fecha</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.arrowBtn}
            onPress={goPrevDay}
            accessibilityLabel="Día anterior"
            activeOpacity={0.6}
          >
            <Text style={styles.arrowBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.dateCenter}>
            <Text style={styles.datePrimary}>{formattedLabel}</Text>
            <Text style={styles.dateSecondary}>{dateISO}</Text>
          </View>
          <TouchableOpacity
            style={[styles.arrowBtn, isAtToday && styles.arrowBtnDisabled]}
            onPress={goNextDay}
            disabled={isAtToday}
            accessibilityLabel="Día siguiente"
            activeOpacity={0.6}
          >
            <Text style={[styles.arrowBtnText, isAtToday && styles.arrowBtnTextDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
        {!isAtToday && (
          <TouchableOpacity style={styles.todayBtn} onPress={setToday} activeOpacity={0.7}>
            <Text style={styles.todayBtnText}>Ir a hoy</Text>
          </TouchableOpacity>
        )}

        <View style={styles.progressCard}>
          <Text style={styles.progressText}>
            {takenCount} / {supplements.length} suplementos
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: supplements.length ? `${(takenCount / supplements.length) * 100}%` : '0%',
                  backgroundColor: phaseColor,
                },
              ]}
            />
          </View>
        </View>

        {!dataLoading && !fetchError && (
          <>
            <Text style={styles.sectionTitle}>Lista</Text>
            {showEmptySupplements && (
              <Text style={styles.emptyText}>
                {cyclePhase ? 'Sin suplementos para esta fase.' : 'Sin datos de fase.'}
              </Text>
            )}
            {supplements.map((s) => {
              const localId = idByNotionId[s.notion_id];
              const taken = localId ? isTaken(localId) : false;
              return (
                <TouchableOpacity
                  key={s.notion_id}
                  style={[styles.supRow, taken && styles.supRowTaken]}
                  onPress={() => {
                    if (!localId) return;
                    markTaken(localId, !taken);
                  }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      taken && { backgroundColor: phaseColor, borderColor: phaseColor },
                    ]}
                  />
                  <View>
                    <Text style={styles.supName}>{s.name}</Text>
                    <Text style={styles.supDose}>{s.dose}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: theme.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    backgroundColor: theme.bgElevated,
  },
  topBarSide: { flex: 1 },
  backLabel: { fontSize: 17, color: theme.text, fontWeight: '500' },
  topTitle: {
    flex: 2,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
  },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  sectionLabel: {
    fontSize: 12,
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 4,
  },
  arrowBtn: {
    width: 48,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowBtnDisabled: { opacity: 0.35 },
  arrowBtnText: { fontSize: 28, color: theme.text, fontWeight: '300', lineHeight: 32 },
  arrowBtnTextDisabled: { color: theme.textMuted },
  dateCenter: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 },
  datePrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  dateSecondary: { fontSize: 12, color: theme.textMuted, marginTop: 4 },
  todayBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  todayBtnText: { fontSize: 14, fontWeight: '600', color: theme.text },
  progressCard: { backgroundColor: theme.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
  progressText: { fontSize: 14, color: theme.textSecondary, marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: theme.trackBg, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: theme.text, marginTop: 8 },
  emptyText: { color: theme.textMuted, fontStyle: 'italic' },
  muted: { color: theme.textMuted, fontSize: 14 },
  supRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  supRowTaken: { opacity: 0.5 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.borderStrong,
  },
  supName: { fontSize: 16, fontWeight: '500', color: theme.text },
  supDose: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  errorBanner: {
    backgroundColor: theme.errorBg,
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: theme.errorText, fontSize: 13 },
});
