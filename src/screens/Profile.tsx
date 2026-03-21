import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { usePostHog } from 'posthog-react-native';
import { useUser } from '../context/UserContext';
import { useHealthData } from '../hooks/useHealthData';
import type { CycleDataSource } from '../types';

const SOURCE_LABELS: Record<CycleDataSource, string> = {
  healthkit: 'Salud (HealthKit)',
  sqlite: 'Base local (última sync)',
  notion: 'Notion',
};

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
  const posthog = usePostHog();
  const { user, setUser, clearStoredUserAndShowPicker } = useUser();
  const {
    cyclePhase,
    cycleDay,
    loading,
    error,
    cycleDataSource,
    healthKitDiagnostics,
    refetch,
  } = useHealthData(user);

  const onRetryHealthKit = () => {
    posthog?.capture('healthkit_sync_retried', { user });
    refetch();
  };

  const sendPostHogTest = () => {
    posthog?.capture('posthog_integration_verify_manual', {
      trigger: 'profile_button',
      user,
      at: new Date().toISOString(),
    });
    Alert.alert(
      'PostHog',
      'Evento de prueba enviado. Búscalo en PostHog → Activity (puede tardar unos segundos).'
    );
  };

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
        <TouchableOpacity
          style={styles.changeUserBtn}
          onPress={clearStoredUserAndShowPicker}
          activeOpacity={0.7}
        >
          <Text style={styles.changeUserBtnText}>Cambiar usuario</Text>
        </TouchableOpacity>
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

      {Platform.OS === 'ios' && (
        <View style={styles.qaCard}>
          <Text style={styles.qaTitle}>Ciclo menstrual (QA)</Text>
          <Text style={styles.qaLine}>
            <Text style={styles.qaMuted}>Origen: </Text>
            {loading ? '…' : SOURCE_LABELS[cycleDataSource]}
          </Text>
          {healthKitDiagnostics && (
            <>
              <Text style={styles.qaLine}>
                <Text style={styles.qaMuted}>Módulo HealthKit: </Text>
                {healthKitDiagnostics.nativeModuleLoaded ? 'cargado' : 'no disponible (¿Expo Go?)'}
              </Text>
              <Text style={styles.qaLine}>
                <Text style={styles.qaMuted}>Salud en dispositivo: </Text>
                {healthKitDiagnostics.healthStoreAvailable ? 'sí' : 'no'}
              </Text>
            </>
          )}
          <Text style={styles.qaHint}>
            Dev build requerida. Si no pide permiso: Ajustes → Salud → Acceso a datos → La Comuna.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={onRetryHealthKit}
            activeOpacity={0.7}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#333" />
            ) : (
              <Text style={styles.retryBtnText}>Reintentar sincronización con Salud</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {__DEV__ && (
        <TouchableOpacity style={styles.testBtn} onPress={sendPostHogTest} activeOpacity={0.7}>
          <Text style={styles.testBtnText}>Enviar evento de prueba (PostHog)</Text>
        </TouchableOpacity>
      )}
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
  changeUserBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  changeUserBtnText: { fontSize: 14, fontWeight: '600', color: '#666' },
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
  testBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCC',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  testBtnText: { fontSize: 13, color: '#666' },
  qaCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    gap: 8,
  },
  qaTitle: { fontSize: 13, fontWeight: '700', color: '#444' },
  qaLine: { fontSize: 13, color: '#333' },
  qaMuted: { color: '#888' },
  qaHint: { fontSize: 11, color: '#888', lineHeight: 16, marginTop: 4 },
  retryBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: '#333' },
});
