import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePostHog } from 'posthog-react-native';
import { useUser, type User } from '../context/UserContext';
import { useHealthData } from '../hooks/useHealthData';
import DailyLogByDate from './DailyLogByDate';
import type { CycleDataSource } from '../types';

/** Poner en `true` para mostrar de nuevo diagnóstico HealthKit y reintentar sync en Perfil. */
const SHOW_HEALTHKIT_QA = false;

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

const DEFAULT_USER_EMOJI = '🌿';
const USER_EMOJIS = ['🌿', '🌸', '🦋', '🌙', '✨', '🔮', '🌺', '🍄', '🌊', '🦅'] as const;
const emojiKeyForUser = (u: User) => `user_emoji_${u}`;

type ProfileProps = {
  /** Vuelve a la zona principal (p. ej. Inicio); la barra inferior también cambia de pestaña. */
  onBackToTabs: () => void;
};

export default function Profile({ onBackToTabs }: ProfileProps) {
  const posthog = usePostHog();
  const [dailyLogOpen, setDailyLogOpen] = React.useState(false);
  const { user, setUser, clearStoredUserAndShowPicker } = useUser();
  const [userEmojiByUser, setUserEmojiByUser] = React.useState<Record<User, string>>({
    diana: DEFAULT_USER_EMOJI,
    estefania: DEFAULT_USER_EMOJI,
  });

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [dianaRaw, estefaniaRaw] = await Promise.all([
          AsyncStorage.getItem(emojiKeyForUser('diana')),
          AsyncStorage.getItem(emojiKeyForUser('estefania')),
        ]);
        if (cancelled) return;
        setUserEmojiByUser({
          diana: dianaRaw || DEFAULT_USER_EMOJI,
          estefania: estefaniaRaw || DEFAULT_USER_EMOJI,
        });
      } catch {
        // Fallback silencioso a DEFAULT_USER_EMOJI.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistEmoji = React.useCallback((u: User, emoji: string) => {
    setUserEmojiByUser((prev) => ({ ...prev, [u]: emoji }));
    void AsyncStorage.setItem(emojiKeyForUser(u), emoji).catch(() => {});
  }, []);

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

  const phaseColor = cyclePhase ? PHASE_COLORS[cyclePhase] : '#ccc';
  const phaseLabel = cyclePhase ? PHASE_LABELS[cyclePhase] : '—';

  if (dailyLogOpen) {
    return <DailyLogByDate onBack={() => setDailyLogOpen(false)} />;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
    >
      <TouchableOpacity
        onPress={onBackToTabs}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Volver a inicio"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.backRow}
      >
        <Text style={styles.backChevron}>‹</Text>
        <Text style={styles.backLabel}>Inicio</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Perfil</Text>

      <View style={styles.selectorCard}>
        <Text style={styles.selectorLabel}>Usuario activo</Text>
        <View style={styles.selectorRow}>
          <View style={styles.selectorUserStack}>
            <TouchableOpacity
              style={[styles.selectorBtn, user === 'diana' && styles.selectorBtnActive]}
              onPress={() => setUser('diana')}
            >
              <Text style={[styles.selectorBtnText, user === 'diana' && styles.selectorBtnTextActive]}>
                Diana
              </Text>
            </TouchableOpacity>
            <View style={styles.emojiPickerRow}>
              {USER_EMOJIS.map((emoji) => {
                const active = userEmojiByUser.diana === emoji;
                return (
                  <TouchableOpacity
                    key={`diana-${emoji}`}
                    onPress={() => persistEmoji('diana', emoji)}
                    style={[styles.emojiChip, active && styles.emojiChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.emojiChipText, active && styles.emojiChipTextActive]}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.selectorUserStack}>
            <TouchableOpacity
              style={[styles.selectorBtn, user === 'estefania' && styles.selectorBtnActive]}
              onPress={() => setUser('estefania')}
            >
              <Text style={[styles.selectorBtnText, user === 'estefania' && styles.selectorBtnTextActive]}>
                Estefanía
              </Text>
            </TouchableOpacity>
            <View style={styles.emojiPickerRow}>
              {USER_EMOJIS.map((emoji) => {
                const active = userEmojiByUser.estefania === emoji;
                return (
                  <TouchableOpacity
                    key={`estefania-${emoji}`}
                    onPress={() => persistEmoji('estefania', emoji)}
                    style={[styles.emojiChip, active && styles.emojiChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.emojiChipText, active && styles.emojiChipTextActive]}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.changeUserBtn}
          onPress={clearStoredUserAndShowPicker}
          activeOpacity={0.7}
        >
          <Text style={styles.changeUserBtnText}>Cambiar usuario</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.linkCard}
        onPress={() => setDailyLogOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.linkCardTitle}>Mis tomas por día</Text>
        <Text style={styles.linkCardSubtitle}>Ver o corregir suplementos tomados en cualquier fecha</Text>
      </TouchableOpacity>

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

      {SHOW_HEALTHKIT_QA && Platform.OS === 'ios' && (
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { padding: 20, paddingBottom: 32, gap: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, marginBottom: 4 },
  backChevron: { fontSize: 28, fontWeight: '300', color: '#222', lineHeight: 32, marginTop: -2 },
  backLabel: { fontSize: 17, fontWeight: '600', color: '#222' },
  title: { fontSize: 24, fontWeight: '700', color: '#222' },
  selectorCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  selectorLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  selectorRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  selectorUserStack: { flex: 1 },
  selectorBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    width: '100%',
  },
  selectorBtnActive: { borderColor: '#222', backgroundColor: '#222' },
  selectorBtnText: { fontSize: 16, fontWeight: '600', color: '#888' },
  selectorBtnTextActive: { color: '#fff' },
  emojiPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 10 },
  emojiChip: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
  },
  emojiChipActive: { borderColor: '#222', backgroundColor: '#222' },
  emojiChipText: { fontSize: 18 },
  emojiChipTextActive: { color: '#fff' },
  changeUserBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  changeUserBtnText: { fontSize: 14, fontWeight: '600', color: '#666' },
  linkCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  linkCardTitle: { fontSize: 16, fontWeight: '600', color: '#222' },
  linkCardSubtitle: { fontSize: 13, color: '#888', marginTop: 6, lineHeight: 18 },
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
  qaCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    gap: 8,
  },
  qaTitle: { fontSize: 13, fontWeight: '700', color: '#444' },
  qaHint: { fontSize: 11, color: '#888', lineHeight: 16, marginTop: 4 },
  qaLine: { fontSize: 13, color: '#333' },
  qaMuted: { color: '#888' },
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
