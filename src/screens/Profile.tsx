import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { usePostHog } from 'posthog-react-native';
import {
  PROFILES,
  getNotionPhaseRowLabel,
  getProfileLabel,
  getProfileOverrides,
  profileIdsRecord,
  saveProfileOverrides,
  type ProfileId,
} from '../config/profiles';
import { clearNotionSettings, getNotionSettingsSource } from '../config/notionSettings';
import { useUser, type User } from '../context/UserContext';
import { useHealthData } from '../hooks/useHealthData';
import { useCalendarDayLocal } from '../hooks/useSelectableLogDate';
import {
  FLOATING_TAB_BAR_EXTRA,
  SCREEN_PADDING_TOP_EXTRA,
  SCREEN_SCROLL_PADDING_BOTTOM_EXTRA,
} from '../constants/floatingTabBar';
import { theme } from '../theme/colors';
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

const USER_EMOJIS = ['🌿', '🌸', '🦋', '🌙', '✨', '🔮', '🌺', '🍄', '🌊', '🦅'] as const;
const emojiKeyForUser = (u: User) => `user_emoji_${u}`;

type ProfileProps = {
  /** Vuelve a la zona principal (p. ej. Inicio); la barra inferior también cambia de pestaña. */
  onBackToTabs: () => void;
  /** La usuaria desconectó Notion: la app vuelve al onboarding de conexión. */
  onNotionDisconnected: () => void;
};

export default function Profile({ onBackToTabs, onNotionDisconnected }: ProfileProps) {
  const insets = useSafeAreaInsets();
  const calendarDayKey = useCalendarDayLocal();
  const posthog = usePostHog();
  const [dailyLogOpen, setDailyLogOpen] = React.useState(false);
  const { user, setUser, clearStoredUserAndShowPicker } = useUser();
  const [userEmojiByUser, setUserEmojiByUser] = React.useState<Record<User, string>>(() =>
    profileIdsRecord((id) => PROFILES.find((p) => p.id === id)!.emojiDefault),
  );

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const entries = await Promise.all(
          PROFILES.map(
            async (p) => [p.id, await AsyncStorage.getItem(emojiKeyForUser(p.id))] as const,
          ),
        );
        if (cancelled) return;
        const next = profileIdsRecord(
          (id) =>
            entries.find(([eid]) => eid === id)?.[1] ||
            PROFILES.find((p) => p.id === id)!.emojiDefault,
        );
        setUserEmojiByUser(next);
      } catch {
        // Fallback silencioso a emoji por defecto del perfil.
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
    healthKitIrregularCycleHint,
    healthKitLifecycleContext,
    refetch,
  } = useHealthData(user, { calendarDayKey });

  const onRetryHealthKit = () => {
    posthog?.capture('healthkit_sync_retried', { user });
    refetch();
  };

  const notionSource = getNotionSettingsSource();

  // Edición runtime de nombre mostrado y persona en Notion por perfil.
  const [profileNameDrafts, setProfileNameDrafts] = React.useState<Record<ProfileId, string>>(() =>
    profileIdsRecord((id) => getProfileLabel(id)),
  );
  const [personaDrafts, setPersonaDrafts] = React.useState<Record<ProfileId, string>>(() =>
    profileIdsRecord((id) => getNotionPhaseRowLabel(id)),
  );

  const commitProfileEdits = React.useCallback(
    (id: ProfileId) => {
      const label = profileNameDrafts[id].trim();
      const persona = personaDrafts[id].trim();
      const prev = getProfileOverrides();
      void saveProfileOverrides({
        profileLabels: { ...prev.profileLabels, ...(label ? { [id]: label } : {}) },
        notionByProfile: {
          ...prev.notionByProfile,
          ...(persona ? { [id]: { supplementPersona: persona, phaseRowLabel: persona } } : {}),
        },
      }).catch(() => {});
      posthog?.capture('profile_overrides_edited', { profile: id });
    },
    [personaDrafts, posthog, profileNameDrafts],
  );

  const onDisconnectNotion = React.useCallback(() => {
    Alert.alert(
      'Desconectar Notion',
      'Se borrará el token guardado en este teléfono. Tus datos en Notion no se tocan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await clearNotionSettings();
              posthog?.capture('notion_disconnected');
              onNotionDisconnected();
            })();
          },
        },
      ],
    );
  }, [onNotionDisconnected, posthog]);

  const phaseColor = cyclePhase ? PHASE_COLORS[cyclePhase] : '#ccc';
  const phaseLabel = cyclePhase ? PHASE_LABELS[cyclePhase] : '—';

  if (dailyLogOpen) {
    return <DailyLogByDate onBack={() => setDailyLogOpen(false)} />;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: SCREEN_PADDING_TOP_EXTRA + insets.top,
          paddingBottom:
            SCREEN_SCROLL_PADDING_BOTTOM_EXTRA + insets.bottom + FLOATING_TAB_BAR_EXTRA,
        },
      ]}
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
          {PROFILES.map((profile) => (
            <View key={profile.id} style={styles.selectorUserStack}>
              <TouchableOpacity
                style={[styles.selectorBtn, user === profile.id && styles.selectorBtnActive]}
                onPress={() => setUser(profile.id)}
              >
                <Text
                  style={[
                    styles.selectorBtnText,
                    user === profile.id && styles.selectorBtnTextActive,
                  ]}
                >
                  {getProfileLabel(profile.id)}
                </Text>
              </TouchableOpacity>
              <View style={styles.emojiPickerRow}>
                {USER_EMOJIS.map((emoji) => {
                  const active = userEmojiByUser[profile.id] === emoji;
                  return (
                    <TouchableOpacity
                      key={`${profile.id}-${emoji}`}
                      onPress={() => persistEmoji(profile.id, emoji)}
                      style={[styles.emojiChip, active && styles.emojiChipActive]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.emojiChipText, active && styles.emojiChipTextActive]}>
                        {emoji}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
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
        <Text style={styles.linkCardSubtitle}>
          Ver o corregir suplementos tomados en cualquier fecha
        </Text>
      </TouchableOpacity>

      <View style={styles.selectorCard}>
        <Text style={styles.selectorLabel}>Nombres de perfil</Text>
        {PROFILES.map((profile) => (
          <View key={profile.id} style={styles.profileEditRow}>
            <TextInput
              style={styles.profileEditInput}
              value={profileNameDrafts[profile.id]}
              onChangeText={(t) => setProfileNameDrafts((prev) => ({ ...prev, [profile.id]: t }))}
              onEndEditing={() => commitProfileEdits(profile.id)}
              placeholder="Nombre mostrado"
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={`Nombre mostrado del perfil ${getProfileLabel(profile.id)}`}
            />
            <TextInput
              style={styles.profileEditInput}
              value={personaDrafts[profile.id]}
              onChangeText={(t) => setPersonaDrafts((prev) => ({ ...prev, [profile.id]: t }))}
              onEndEditing={() => commitProfileEdits(profile.id)}
              placeholder="Persona en Notion"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              accessibilityLabel={`Persona en Notion del perfil ${getProfileLabel(profile.id)}`}
            />
          </View>
        ))}
        <Text style={styles.qaHint}>
          «Persona en Notion» debe coincidir con la fila de tu tabla de fases y el select Persona de
          la DB de suplementos.
        </Text>
      </View>

      <View style={styles.selectorCard}>
        <Text style={styles.selectorLabel}>Conexión Notion</Text>
        <Text style={styles.notionStatusText}>
          {notionSource === 'stored'
            ? 'Conectada desde la app (token en el llavero del teléfono).'
            : 'Configurada en el build (.env) — modo desarrollo/fork.'}
        </Text>
        {notionSource === 'stored' && (
          <TouchableOpacity
            style={styles.changeUserBtn}
            onPress={onDisconnectNotion}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Desconectar Notion"
          >
            <Text style={styles.disconnectBtnText}>Desconectar Notion…</Text>
          </TouchableOpacity>
        )}
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
            {cycleDay !== null && <Text style={styles.cycleDay}>Día {cycleDay} del ciclo</Text>}
          </>
        )}
      </View>

      {Platform.OS === 'ios' &&
        !loading &&
        (healthKitIrregularCycleHint || healthKitLifecycleContext !== 'none') && (
          <View style={styles.healthContextCard}>
            {healthKitIrregularCycleHint && (
              <Text style={styles.healthContextText}>
                En Salud constan datos de ciclo irregular reciente; la fase mostrada es orientativa.
              </Text>
            )}
            {healthKitLifecycleContext === 'pregnancy' && (
              <Text style={styles.healthContextText}>
                Hay un test de embarazo positivo reciente en Salud; no sincronizamos la fase
                automáticamente con Notion.
              </Text>
            )}
            {healthKitLifecycleContext === 'lactation' && (
              <Text style={styles.healthContextText}>
                Hay datos de lactancia recientes en Salud; no sincronizamos la fase automáticamente
                con Notion.
              </Text>
            )}
            {healthKitLifecycleContext === 'contraceptive' && (
              <Text style={styles.healthContextText}>
                Hay registro de anticonceptivo reciente en Salud; la fase calculada es solo
                orientativa.
              </Text>
            )}
          </View>
        )}

      {__DEV__ && (
        <View style={styles.qaCard}>
          <Text style={styles.qaTitle}>Sentry (solo desarrollo)</Text>
          <Text style={styles.qaHint}>
            Comprueba en Issues del proyecto que llega el evento de prueba.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              Sentry.captureException(new Error('First error'));
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.retryBtnText}>Enviar error de prueba</Text>
          </TouchableOpacity>
        </View>
      )}

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
              <ActivityIndicator color={theme.text} />
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
  scroll: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: 20, paddingBottom: SCREEN_SCROLL_PADDING_BOTTOM_EXTRA, gap: 16 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginBottom: 4,
  },
  backChevron: {
    fontSize: 28,
    fontWeight: '300',
    color: theme.text,
    lineHeight: 32,
    marginTop: -2,
  },
  backLabel: { fontSize: 17, fontWeight: '600', color: theme.text },
  title: { fontSize: 24, fontWeight: '700', color: theme.text },
  selectorCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  selectorLabel: {
    fontSize: 12,
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  selectorRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  selectorUserStack: { flex: 1 },
  selectorBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bgElevated,
    alignItems: 'center',
    width: '100%',
  },
  selectorBtnActive: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
  selectorBtnText: { fontSize: 16, fontWeight: '600', color: theme.textMuted },
  selectorBtnTextActive: { color: theme.text },
  emojiPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 10,
  },
  emojiChip: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
  },
  emojiChipActive: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
  emojiChipText: { fontSize: 18 },
  emojiChipTextActive: { color: theme.text },
  changeUserBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  changeUserBtnText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  profileEditRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  profileEditInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    backgroundColor: theme.bgElevated,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  notionStatusText: { fontSize: 14, color: theme.text, lineHeight: 20 },
  disconnectBtnText: { fontSize: 14, fontWeight: '600', color: theme.errorText },
  linkCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.border,
  },
  linkCardTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
  linkCardSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 18 },
  phaseCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    backgroundColor: theme.card,
    borderColor: theme.border,
    alignItems: 'center',
  },
  phaseLabelSmall: {
    fontSize: 12,
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  phaseValue: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  cycleDay: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },
  healthContextCard: {
    backgroundColor: theme.warningBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  healthContextText: { fontSize: 13, color: theme.warningText, lineHeight: 19 },
  errorText: { color: theme.errorText, fontSize: 14, marginTop: 4 },
  qaCard: {
    backgroundColor: theme.bgElevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 8,
  },
  qaTitle: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
  qaHint: { fontSize: 11, color: theme.textMuted, lineHeight: 16, marginTop: 4 },
  qaLine: { fontSize: 13, color: theme.text },
  qaMuted: { color: theme.textMuted },
  retryBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.card,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: theme.text },
});
