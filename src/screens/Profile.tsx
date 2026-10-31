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
  Linking,
  Switch,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { usePostHog } from 'posthog-react-native';
import {
  MAX_PROFILES,
  addProfile,
  getDefaultEmoji,
  getNotionPhaseRowLabel,
  getProfileLabel,
  getProfileOverrides,
  getProfiles,
  profileIdsRecord,
  profileTracksCycle,
  removeLastProfile,
  saveProfileOverrides,
  setProfileTracksCycle,
  subscribeProfileOverrides,
  type ProfileId,
} from '../config/profiles';
import { isDiagnosticsOptedOut, setDiagnosticsOptedOut } from '../utils/observability';
import { setUiPref, useUiPrefs } from '../config/uiPrefs';
import {
  isNutrientsHealthSyncEnabled,
  setNutrientsHealthSyncEnabled,
} from '../api/nutrientsHealth';
import { clearNotionSettings, getNotionSettingsSource } from '../config/notionSettings';
import { useReminders } from '../hooks/useReminders';
import { formatReminderTime, parseReminderTime } from '../utils/reminderSchedule';
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

/** Sin verbo de donación en la app (guideline 3.2.2); la donación vive en GitHub. */
const GITHUB_REPO_URL = 'https://github.com/sistemasconscientes/comuna-app';
/** URL canónica de la política (la misma que va en App Store Connect). */
const PRIVACY_POLICY_URL = `${GITHUB_REPO_URL}/blob/main/docs/PRIVACY.md`;
const LICENSE_URL = `${GITHUB_REPO_URL}/blob/main/LICENSE`;

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
  const [userEmojiByUser, setUserEmojiByUser] = React.useState<Partial<Record<User, string>>>(() =>
    profileIdsRecord(getDefaultEmoji),
  );
  /** Re-render al agregar/quitar perfiles o cambiar «sigue ciclo». */
  const [profilesVersion, bumpProfilesVersion] = React.useReducer((v: number) => v + 1, 0);
  React.useEffect(() => subscribeProfileOverrides(bumpProfilesVersion), []);
  const profiles = getProfiles();
  /** Perfil con el panel de edición abierto (uno a la vez para no saturar la pantalla). */
  const [editingId, setEditingId] = React.useState<ProfileId | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const entries = await Promise.all(
          getProfiles().map(
            async (p) => [p.id, await AsyncStorage.getItem(emojiKeyForUser(p.id))] as const,
          ),
        );
        if (cancelled) return;
        const next = profileIdsRecord(
          (id) => entries.find(([eid]) => eid === id)?.[1] || getDefaultEmoji(id),
        );
        setUserEmojiByUser(next);
      } catch {
        // Fallback silencioso a emoji por defecto del perfil.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profilesVersion]);

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
    tracksCycle,
    refetch,
  } = useHealthData(user, { calendarDayKey });

  const onRetryHealthKit = () => {
    posthog?.capture('healthkit_sync_retried', { user });
    refetch();
  };

  const notionSource = getNotionSettingsSource();

  // Edición runtime de nombre mostrado y persona en Notion por perfil.
  const [profileNameDrafts, setProfileNameDrafts] = React.useState<
    Partial<Record<ProfileId, string>>
  >(() => profileIdsRecord((id) => getProfileLabel(id)));
  const [personaDrafts, setPersonaDrafts] = React.useState<Partial<Record<ProfileId, string>>>(() =>
    profileIdsRecord((id) => getNotionPhaseRowLabel(id)),
  );

  // Reconexión/saneo cambian los overrides por fuera: refrescar los drafts.
  React.useEffect(
    () =>
      subscribeProfileOverrides(() => {
        setProfileNameDrafts(profileIdsRecord((id) => getProfileLabel(id)));
        setPersonaDrafts(profileIdsRecord((id) => getNotionPhaseRowLabel(id)));
      }),
    [],
  );

  const commitProfileEdits = React.useCallback(
    (id: ProfileId) => {
      const label = (profileNameDrafts[id] ?? '').trim();
      const persona = (personaDrafts[id] ?? '').trim();
      const prev = getProfileOverrides();
      void saveProfileOverrides({
        ...prev,
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

  const onAddProfile = React.useCallback(() => {
    void (async () => {
      const id = await addProfile();
      if (!id) return;
      setEditingId(id);
      posthog?.capture('profile_added', { profile_count: getProfiles().length });
    })();
  }, [posthog]);

  const onRemoveLastProfile = React.useCallback(() => {
    const last = getProfiles().at(-1);
    if (!last) return;
    Alert.alert(
      `Quitar «${getProfileLabel(last.id)}»`,
      'Se quita de este teléfono. Sus datos en Notion no se tocan y su historial local se conserva por si lo vuelves a agregar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: () => {
            void removeLastProfile();
            if (editingId === last.id) setEditingId(null);
            posthog?.capture('profile_removed', { profile_count: getProfiles().length - 1 });
          },
        },
      ],
    );
  }, [editingId, posthog]);

  const onToggleTracksCycle = React.useCallback(
    (id: ProfileId, tracks: boolean) => {
      void setProfileTracksCycle(id, tracks);
      posthog?.capture('profile_cycle_tracking_changed', { tracks_cycle: tracks });
    },
    [posthog],
  );

  const { simpleMode } = useUiPrefs();

  // Nutrientes → Apple Salud: opt-in del perfil activo (Salud es de quien usa este teléfono).
  const [nutrientsSync, setNutrientsSync] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    void isNutrientsHealthSyncEnabled(user).then((on) => {
      if (!cancelled) setNutrientsSync(on);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);
  const onToggleNutrientsSync = React.useCallback(
    (on: boolean) => {
      setNutrientsSync(on);
      void setNutrientsHealthSyncEnabled(user, on);
      posthog?.capture('nutrients_health_sync_changed', { enabled: on });
    },
    [posthog, user],
  );

  const [diagnosticsOn, setDiagnosticsOn] = React.useState(() => !isDiagnosticsOptedOut());
  const onToggleDiagnostics = React.useCallback(
    (on: boolean) => {
      setDiagnosticsOn(on);
      void setDiagnosticsOptedOut(!on);
      if (on) {
        void posthog?.optIn();
      } else {
        void posthog?.optOut();
      }
    },
    [posthog],
  );

  const onDisconnectNotion = React.useCallback(() => {
    const demo = notionSource === 'demo';
    Alert.alert(
      demo ? 'Salir del modo de ejemplo' : 'Desconectar Notion',
      demo
        ? 'Volverás a la pantalla de conexión para enlazar tu Notion.'
        : 'Se borrará el token guardado en este teléfono. Tus datos en Notion no se tocan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: demo ? 'Salir' : 'Desconectar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await clearNotionSettings();
              posthog?.capture(demo ? 'notion_demo_mode_exited' : 'notion_disconnected');
              onNotionDisconnected();
            })();
          },
        },
      ],
    );
  }, [notionSource, onNotionDisconnected, posthog]);

  const reminders = useReminders();
  const [reminderTimeDraft, setReminderTimeDraft] = React.useState<string | null>(null);
  const reminderTimeShown =
    reminderTimeDraft ?? formatReminderTime(reminders.settings.hour, reminders.settings.minute);

  const commitReminderTime = React.useCallback(() => {
    if (reminderTimeDraft == null) return;
    const parsed = parseReminderTime(reminderTimeDraft);
    if (parsed) reminders.setTime(parsed.hour, parsed.minute);
    setReminderTimeDraft(null);
  }, [reminderTimeDraft, reminders, setReminderTimeDraft]);

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
        <Text style={styles.selectorLabel}>Perfiles en este teléfono</Text>
        {profiles.map((profile, index) => {
          const active = user === profile.id;
          const editing = editingId === profile.id;
          const emoji = userEmojiByUser[profile.id] ?? profile.emojiDefault;
          const cycle = profileTracksCycle(profile.id);
          return (
            <View key={profile.id} style={styles.profileRowBlock}>
              <View style={styles.profileRow}>
                <TouchableOpacity
                  style={[styles.profileRowMain, active && styles.selectorBtnActive]}
                  onPress={() => setUser(profile.id)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Usar el perfil ${getProfileLabel(profile.id)}`}
                >
                  <Text style={styles.profileRowEmoji}>{emoji}</Text>
                  <View style={styles.profileRowTextCol}>
                    <Text
                      style={[styles.selectorBtnText, active && styles.selectorBtnTextActive]}
                      numberOfLines={1}
                    >
                      {getProfileLabel(profile.id)}
                    </Text>
                    <Text style={styles.profileRowMeta}>
                      {active ? 'Activo · ' : ''}
                      {cycle ? 'Sigue ciclo' : 'Sin seguimiento de ciclo'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.profileEditToggle}
                  onPress={() => setEditingId(editing ? null : profile.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: editing }}
                  accessibilityLabel={`Editar el perfil ${getProfileLabel(profile.id)}`}
                >
                  <Text style={styles.profileEditToggleText}>{editing ? 'Listo' : 'Editar'}</Text>
                </TouchableOpacity>
              </View>

              {editing && (
                <View style={styles.profileEditPanel}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.emojiPickerRow}
                  >
                    {USER_EMOJIS.map((e) => {
                      const selected = emoji === e;
                      return (
                        <TouchableOpacity
                          key={`${profile.id}-${e}`}
                          onPress={() => persistEmoji(profile.id, e)}
                          style={[styles.emojiChip, selected && styles.emojiChipActive]}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Emoji ${e}`}
                        >
                          <Text
                            style={[styles.emojiChipText, selected && styles.emojiChipTextActive]}
                          >
                            {e}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <View style={styles.profileEditRow}>
                    <View style={styles.profileEditField}>
                      <Text style={styles.profileEditFieldLabel}>Nombre en la app</Text>
                      <TextInput
                        style={styles.profileEditInput}
                        value={profileNameDrafts[profile.id] ?? ''}
                        onChangeText={(t) =>
                          setProfileNameDrafts((prev) => ({ ...prev, [profile.id]: t }))
                        }
                        onEndEditing={() => commitProfileEdits(profile.id)}
                        placeholder={`Perfil ${index + 1}`}
                        placeholderTextColor={theme.textMuted}
                        accessibilityLabel={`Nombre en la app del perfil ${index + 1}`}
                      />
                    </View>
                    <View style={styles.profileEditField}>
                      <Text style={styles.profileEditFieldLabel}>Persona en Notion</Text>
                      <TextInput
                        style={styles.profileEditInput}
                        value={personaDrafts[profile.id] ?? ''}
                        onChangeText={(t) =>
                          setPersonaDrafts((prev) => ({ ...prev, [profile.id]: t }))
                        }
                        onEndEditing={() => commitProfileEdits(profile.id)}
                        placeholder="Igual que en Notion"
                        placeholderTextColor={theme.textMuted}
                        autoCapitalize="none"
                        accessibilityLabel={`Persona en Notion del perfil ${index + 1}`}
                      />
                    </View>
                  </View>
                  <View style={styles.reminderRow}>
                    <Text style={styles.reminderLabel}>Sigue ciclo menstrual</Text>
                    <Switch
                      value={cycle}
                      onValueChange={(v) => onToggleTracksCycle(profile.id, v)}
                      accessibilityLabel={`Seguimiento de ciclo para ${getProfileLabel(profile.id)}`}
                    />
                  </View>
                  <Text style={styles.qaHint}>
                    Sin ciclo: la app no calcula fases ni lee el ciclo en Apple Salud, y muestra los
                    suplementos que no dependen de una fase. «Persona en Notion» debe coincidir con
                    el select Persona (y con la fila de la tabla de fases, si sigue ciclo).
                  </Text>
                </View>
              )}
            </View>
          );
        })}
        <View style={styles.profileFooterRow}>
          {profiles.length < MAX_PROFILES && (
            <TouchableOpacity
              style={styles.profileFooterBtn}
              onPress={onAddProfile}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.profileFooterBtnText}>+ Agregar perfil</Text>
            </TouchableOpacity>
          )}
          {profiles.length > 1 && (
            <TouchableOpacity
              style={styles.profileFooterBtn}
              onPress={onRemoveLastProfile}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.disconnectBtnText}>Quitar último…</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.changeUserBtn}
          onPress={clearStoredUserAndShowPicker}
          activeOpacity={0.7}
        >
          <Text style={styles.changeUserBtnText}>Volver a la pantalla «¿Quién usa la app?»</Text>
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
        <Text style={styles.selectorLabel}>Recordatorio de registro</Text>
        <View style={styles.reminderRow}>
          <Text style={styles.reminderLabel}>Avisarme si no he registrado mis suplementos</Text>
          <Switch
            value={reminders.settings.enabled}
            onValueChange={reminders.setEnabled}
            disabled={!reminders.hydrated}
            accessibilityLabel="Activar recordatorio de registro"
          />
        </View>
        {reminders.permissionDenied && (
          <Text style={styles.reminderWarn}>
            Permiso de notificaciones denegado. Actívalo en Ajustes → Notificaciones → La Comuna.
          </Text>
        )}
        {reminders.settings.enabled && (
          <View style={styles.reminderTimeRow}>
            {['20:00', '21:00', '22:00'].map((preset) => {
              const active = reminderTimeShown === preset;
              return (
                <TouchableOpacity
                  key={preset}
                  style={[styles.reminderChip, active && styles.reminderChipActive]}
                  onPress={() => {
                    const parsed = parseReminderTime(preset)!;
                    setReminderTimeDraft(null);
                    reminders.setTime(parsed.hour, parsed.minute);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Recordar a las ${preset}`}
                >
                  <Text style={[styles.reminderChipText, active && styles.reminderChipTextActive]}>
                    {preset}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TextInput
              style={[styles.profileEditInput, styles.reminderTimeInput]}
              value={reminderTimeShown}
              onChangeText={setReminderTimeDraft}
              onEndEditing={commitReminderTime}
              keyboardType="numbers-and-punctuation"
              placeholder="HH:MM"
              placeholderTextColor={theme.textMuted}
              accessibilityLabel="Hora del recordatorio"
            />
          </View>
        )}
        <Text style={styles.qaHint}>
          Notificación local en tu teléfono (sin servidores). Si completas el registro del día, no
          suena. Incluye aviso cuando un suplemento baja de ~5 días de stock.
        </Text>
      </View>

      <View style={styles.selectorCard}>
        <Text style={styles.selectorLabel}>Conexión Notion</Text>
        <Text style={styles.notionStatusText}>
          {notionSource === 'stored'
            ? 'Conectada desde la app (token en el llavero del teléfono).'
            : notionSource === 'demo'
              ? 'Modo de ejemplo: datos de muestra, sin conexión a Notion.'
              : 'Configurada en el build (.env) — modo desarrollo/fork.'}
        </Text>
        {(notionSource === 'stored' || notionSource === 'demo') && (
          <TouchableOpacity
            style={styles.changeUserBtn}
            onPress={onDisconnectNotion}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              notionSource === 'demo' ? 'Salir del modo de ejemplo' : 'Desconectar Notion'
            }
          >
            <Text style={styles.disconnectBtnText}>
              {notionSource === 'demo' ? 'Salir del modo de ejemplo…' : 'Desconectar Notion…'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {tracksCycle && (
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
              <Text style={styles.qaHint}>
                Estimación: día del ciclo desde tu último inicio de periodo en Apple Salud y
                duración típica de tus ciclos (mediana de los registrados; 28 días si no hay datos).
                Es orientativa, no un diagnóstico ni un método anticonceptivo.
              </Text>
            </>
          )}
        </View>
      )}

      {tracksCycle &&
        Platform.OS === 'ios' &&
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

      <View style={styles.selectorCard}>
        <Text style={styles.selectorLabel}>Pantalla</Text>
        <View style={styles.reminderRow}>
          <Text style={styles.reminderLabel}>Modo simple</Text>
          <Switch
            value={simpleMode}
            onValueChange={(v) => void setUiPref('simpleMode', v)}
            accessibilityLabel="Modo simple"
          />
        </View>
        <Text style={styles.qaHint}>
          Inicio muestra solo tu energía y la lista del día, agrupada por momento. Oculta el té y la
          barra de fases para que haya menos que mirar.
        </Text>
      </View>

      {Platform.OS === 'ios' && (
        <View style={styles.selectorCard}>
          <Text style={styles.selectorLabel}>Apple Salud</Text>
          <View style={styles.reminderRow}>
            <Text style={styles.reminderLabel}>
              Registrar los nutrientes de mis tomas ({getProfileLabel(user)})
            </Text>
            <Switch
              value={nutrientsSync}
              onValueChange={onToggleNutrientsSync}
              accessibilityLabel="Registrar nutrientes en Apple Salud"
            />
          </View>
          <Text style={styles.qaHint}>
            Al marcar un suplemento como tomado, se guardan en Apple Salud los nutrientes que
            anotaste en Stock (p. ej. «Magnesio 200 mg»). Al desmarcarlo se borran. Actívalo solo en
            tu perfil: los datos van a la app Salud de este teléfono.
          </Text>
        </View>
      )}

      <View style={styles.selectorCard}>
        <Text style={styles.selectorLabel}>Privacidad y datos</Text>
        <View style={styles.reminderRow}>
          <Text style={styles.reminderLabel}>Compartir diagnósticos anónimos</Text>
          <Switch
            value={diagnosticsOn}
            onValueChange={onToggleDiagnostics}
            accessibilityLabel="Compartir diagnósticos anónimos"
          />
        </View>
        <Text style={styles.qaHint}>
          Errores técnicos y uso de pantallas (sin datos de salud, sin contenido de tu Notion) para
          mejorar la app. Apágalo cuando quieras.
        </Text>
        <TouchableOpacity
          style={styles.inlineLink}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          activeOpacity={0.7}
          accessibilityRole="link"
        >
          <Text style={styles.inlineLinkText}>Política de privacidad</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.selectorCard}>
        <Text style={styles.selectorLabel}>Aviso de salud</Text>
        <Text style={styles.notionStatusText}>
          La Comuna organiza lo que tú anotas en tu Notion; no es un dispositivo médico, no
          prescribe suplementos ni dosis y no sustituye el consejo de un profesional de la salud.
          Consulta a tu médico o médica antes de empezar, cambiar o dejar un suplemento.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.linkCard}
        onPress={() => Linking.openURL(GITHUB_REPO_URL)}
        activeOpacity={0.7}
        accessibilityRole="link"
        accessibilityLabel="Abrir el proyecto open source en GitHub"
      >
        <Text style={styles.linkCardTitle}>Proyecto open source · GitHub</Text>
        <Text style={styles.linkCardSubtitle}>
          Proyecto comunitario sin fines de lucro: código, template de Notion y novedades.
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.inlineLink}
        onPress={() => Linking.openURL(LICENSE_URL)}
        activeOpacity={0.7}
        accessibilityRole="link"
      >
        <Text style={styles.licenseText}>
          Software libre bajo licencia GNU GPL v3 · © Laboratorio de Sistemas Conscientes
        </Text>
      </TouchableOpacity>

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
  profileRowBlock: { marginBottom: 10 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bgElevated,
    minHeight: 52,
  },
  profileRowEmoji: { fontSize: 22 },
  profileRowTextCol: { flex: 1 },
  profileRowMeta: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  profileEditToggle: { paddingVertical: 12, paddingHorizontal: 10, minHeight: 44 },
  profileEditToggleText: { fontSize: 14, fontWeight: '600', color: theme.accent },
  profileEditPanel: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.bgElevated,
    gap: 12,
  },
  profileFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  profileFooterBtn: { paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  profileFooterBtnText: { fontSize: 14, fontWeight: '600', color: theme.accent },
  inlineLink: { paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  inlineLinkText: { fontSize: 14, fontWeight: '600', color: theme.accent },
  licenseText: { fontSize: 12, color: theme.textMuted, textAlign: 'center', lineHeight: 17 },
  selectorBtnActive: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
  selectorBtnText: { fontSize: 16, fontWeight: '600', color: theme.textMuted },
  selectorBtnTextActive: { color: theme.text },
  emojiPickerRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
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
  profileEditRow: { flexDirection: 'row', gap: 10 },
  profileEditField: { flex: 1 },
  profileEditFieldLabel: { fontSize: 11, color: theme.textMuted, marginBottom: 4 },
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
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reminderLabel: { flex: 1, fontSize: 14, color: theme.text, lineHeight: 20 },
  reminderWarn: { marginTop: 10, fontSize: 13, color: theme.warningText, lineHeight: 18 },
  reminderTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  reminderChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bgElevated,
  },
  reminderChipActive: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
  reminderChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  reminderChipTextActive: { color: theme.text },
  reminderTimeInput: { flex: 0, minWidth: 74, textAlign: 'center' },
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
