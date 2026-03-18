import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useUser } from '../context/UserContext';
import { useHealthData } from '../hooks/useHealthData';

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

export default function Profile() {
  const { user, setUser } = useUser();
  const { cyclePhase, cycleDay, loading, error } = useHealthData(user);

  const phaseColor = cyclePhase ? PHASE_COLORS[cyclePhase] : '#ccc';
  const phaseLabel = cyclePhase ? PHASE_LABELS[cyclePhase] : '—';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil</Text>

      <View style={styles.selectorCard}>
        <Text style={styles.selectorLabel}>Usuario activo</Text>
        <View style={styles.selectorRow}>
          <TouchableOpacity
            style={[styles.selectorBtn, user === 'diana' && styles.selectorBtnActive]}
            onPress={() => setUser('diana')}
          >
            <Text style={[styles.selectorBtnText, user === 'diana' && styles.selectorBtnTextActive]}>
              Diana
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.selectorBtn, user === 'estefania' && styles.selectorBtnActive]}
            onPress={() => setUser('estefania')}
          >
            <Text style={[styles.selectorBtnText, user === 'estefania' && styles.selectorBtnTextActive]}>
              Estefanía
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.phaseCard, { borderColor: phaseColor }]}>
        <Text style={styles.phaseLabelSmall}>Fase actual</Text>
        {loading ? (
          <Text style={styles.phaseValue}>Cargando…</Text>
        ) : error ? (
          <Text style={styles.errorText}>Error al cargar fase</Text>
        ) : (
          <>
            <Text style={[styles.phaseValue, { color: phaseColor }]}>{phaseLabel}</Text>
            {cycleDay !== null && (
              <Text style={styles.cycleDay}>Día {cycleDay} del ciclo</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', padding: 20, gap: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#222' },
  selectorCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  selectorLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  selectorRow: { flexDirection: 'row', gap: 10 },
  selectorBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  selectorBtnActive: { borderColor: '#222', backgroundColor: '#222' },
  selectorBtnText: { fontSize: 16, fontWeight: '600', color: '#888' },
  selectorBtnTextActive: { color: '#fff' },
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
  errorText: { color: '#C62828', fontSize: 14, marginTop: 4 },
});
