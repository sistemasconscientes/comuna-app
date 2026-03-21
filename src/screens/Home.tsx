import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useHealthData } from '../hooks/useHealthData';
import { useSupplements } from '../hooks/useSupplements';
import { useDailyLog } from '../hooks/useDailyLog';
import { useUser } from '../context/UserContext';
import { getMealPrep } from '../api/notion';

const PHASE_LABELS: Record<string, string> = {
  menstrual: 'Menstrual',
  folicular: 'Folicular',
  ovulacion: 'Ovulación',
  lutea: 'Lútea',
};

const PHASE_COLORS: Record<string, string> = {
  menstrual: '#E57373',
  folicular: '#81C784',
  ovulacion: '#FFD54F',
  lutea: '#BA68C8',
};

export default function Home() {
  getMealPrep().then(result => {
    console.log('getMealPrep result:', JSON.stringify(result?.title), 'blocks:', result?.blocks?.length);
  }).catch(e => {
    console.log('getMealPrep error:', e.message);
  });
  const { user } = useUser();
  const { cyclePhase, cycleDay, loading: healthLoading, error: healthError } = useHealthData(user);
  const { supplements, idByNotionId, error: supplementsError } = useSupplements(
    user,
    cyclePhase ?? '',
  );
  const { isTaken, markTaken } = useDailyLog();

  const phaseColor = cyclePhase ? PHASE_COLORS[cyclePhase] : '#ccc';
  const phaseLabel = cyclePhase ? PHASE_LABELS[cyclePhase] : '—';

  const takenCount = supplements.reduce((count, s) => {
    const localId = idByNotionId[s.notion_id];
    if (!localId) return count;
    return count + (isTaken(localId) ? 1 : 0);
  }, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {(healthError || supplementsError) && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            Error al cargar datos de Notion:{'\n'}
            {(healthError ?? supplementsError)?.message}
          </Text>
        </View>
      )}
      {/* Fase actual */}
      <View style={[styles.phaseCard, { borderColor: phaseColor }]}>
        <Text style={styles.phaseLabelSmall}>Fase actual</Text>
        {healthLoading ? (
          <Text style={styles.phaseValue}>Cargando…</Text>
        ) : (
          <>
            <Text style={[styles.phaseValue, { color: phaseColor }]}>{phaseLabel}</Text>
            {cycleDay !== null && (
              <Text style={styles.cycleDay}>Día {cycleDay} del ciclo</Text>
            )}
          </>
        )}
      </View>

      {/* Progreso del día */}
      <View style={styles.progressCard}>
        <Text style={styles.progressText}>
          {takenCount} / {supplements.length} suplementos tomados hoy
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: supplements.length ? `${(takenCount / supplements.length) * 100}%` : '0%', backgroundColor: phaseColor },
            ]}
          />
        </View>
      </View>

      {/* Lista rápida */}
      <Text style={styles.sectionTitle}>Para hoy</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { padding: 20, gap: 16 },
  phaseCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  phaseLabelSmall: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  phaseValue: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  cycleDay: { fontSize: 14, color: '#888', marginTop: 4 },
  progressCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  progressText: { fontSize: 14, color: '#555', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#222', marginTop: 8 },
  emptyText: { color: '#aaa', fontStyle: 'italic' },
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
    marginBottom: 8,
  },
  errorText: { color: '#C62828', fontSize: 13 },
});
