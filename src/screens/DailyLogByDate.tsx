import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { usePostHog } from 'posthog-react-native';
import { useUser } from '../context/UserContext';
import { useHealthData } from '../hooks/useHealthData';
import { useSupplements } from '../hooks/useSupplements';
import { useDailyLog } from '../hooks/useDailyLog';
import { useSelectableLogDate } from '../hooks/useSelectableLogDate';

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
  const posthog = usePostHog();
  const { user } = useUser();
  const { dateISO, formattedLabel, goPrevDay, goNextDay, setToday, isAtToday } =
    useSelectableLogDate();
  const { cyclePhase, loading: healthLoading, error: healthError } = useHealthData(user);
  const { supplements, idByNotionId, error: supplementsError } = useSupplements(
    user,
    cyclePhase ?? '',
  );
  const { isTaken, markTaken } = useDailyLog(dateISO);

  React.useEffect(() => {
    posthog?.capture('daily_log_history_opened', { user });
  }, [posthog, user]);

  const phaseColor = cyclePhase ? PHASE_COLORS[cyclePhase] : '#ccc';

  const takenCount = supplements.reduce((count, s) => {
    const localId = idByNotionId[s.notion_id];
    if (!localId) return count;
    return count + (isTaken(localId) ? 1 : 0);
  }, 0);

  return (
    <View style={styles.wrapper}>
      <View style={styles.topBar}>
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {(healthError || supplementsError) && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              Error al cargar datos:{'\n'}
              {(healthError ?? supplementsError)?.message}
            </Text>
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

        {healthLoading ? (
          <Text style={styles.muted}>Cargando fase…</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Lista</Text>
            {supplements.length === 0 && (
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
  wrapper: { flex: 1, backgroundColor: '#FAFAFA' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#fff',
  },
  topBarSide: { flex: 1 },
  backLabel: { fontSize: 17, color: '#222', fontWeight: '500' },
  topTitle: {
    flex: 2,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  sectionLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingVertical: 4,
  },
  arrowBtn: {
    width: 48,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowBtnDisabled: { opacity: 0.35 },
  arrowBtnText: { fontSize: 28, color: '#222', fontWeight: '300', lineHeight: 32 },
  arrowBtnTextDisabled: { color: '#999' },
  dateCenter: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 },
  datePrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  dateSecondary: { fontSize: 12, color: '#888', marginTop: 4 },
  todayBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
  },
  todayBtnText: { fontSize: 14, fontWeight: '600', color: '#333' },
  progressCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  progressText: { fontSize: 14, color: '#555', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#222', marginTop: 8 },
  emptyText: { color: '#aaa', fontStyle: 'italic' },
  muted: { color: '#888', fontSize: 14 },
  supRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },
  supRowTaken: { opacity: 0.5 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  supName: { fontSize: 16, fontWeight: '500', color: '#222' },
  supDose: { fontSize: 13, color: '#888', marginTop: 2 },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: '#C62828', fontSize: 13 },
});
