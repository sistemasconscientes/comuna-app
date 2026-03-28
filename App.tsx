import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { usePostHog } from 'posthog-react-native';
import { db } from './src/db';
import migrations from './src/db/migrations/migrations';
import Home from './src/screens/Home';
import Stock from './src/screens/Stock';
import MealPrep from './src/screens/MealPrep';
import Profile from './src/screens/Profile';
import { UserContext } from './src/context/UserContext';
import type { User } from './src/context/UserContext';
import { SENTRY_DSN } from '@env';
import * as Sentry from '@sentry/react-native';
import {
  getAppEnvironment,
  getSentryDist,
  getSentryRelease,
  reportErrorToSentry,
} from './src/utils/observability';

const sentryDsn = (SENTRY_DSN ?? '').trim();

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: getAppEnvironment(),
    release: getSentryRelease(),
    dist: getSentryDist(),
    // https://docs.sentry.io/platforms/react-native/data-management/data-collected/
    sendDefaultPii: true,
    enableLogs: true,
    integrations: [Sentry.feedbackIntegration()],
    // spotlight: __DEV__,
  });
}

const SELECTED_USER_KEY = 'selected_user';
const DEFAULT_USER_EMOJI = '🌿';
const USER_EMOJIS = ['🌿', '🌸', '🦋', '🌙', '✨', '🔮', '🌺', '🍄', '🌊', '🦅'] as const;

type PickerReason = 'no_stored_value' | 'manual_clear';

function parseStoredUser(raw: string | null): User | null {
  if (raw === 'diana' || raw === 'estefania') return raw;
  return null;
}

function persistenceErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function PostHogIdentifyUser({ user }: { user: User }) {
  const posthog = usePostHog();
  React.useEffect(() => {
    posthog?.identify(user, { app: 'comuna' });
  }, [posthog, user]);
  return null;
}

function MigrationFailureReporter({ error }: { error: Error }) {
  const reported = React.useRef(false);
  React.useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    reportErrorToSentry(error, {
      domain: 'drizzle_migrations',
      error_name: error.name,
      message: error.message,
    });
  }, [error]);
  return null;
}

/** Pestañas visibles en la barra inferior (Perfil se abre solo desde ⚙️ en Inicio). */
type TabBarTab = 'home' | 'stock' | 'comidas';
type Tab = TabBarTab | 'perfil';

const TABS: { key: TabBarTab; label: string }[] = [
  { key: 'home', label: 'Inicio' },
  { key: 'stock', label: 'Stock' },
  { key: 'comidas', label: 'Comidas' },
];

function App() {
  const { success, error } = useMigrations(db, migrations);
  const posthog = usePostHog();
  const [activeTab, setActiveTab] = React.useState<Tab>('home');
  const [user, setUserState] = React.useState<User>('diana');
  const userRef = React.useRef(user);
  userRef.current = user;

  const [userHydrated, setUserHydrated] = React.useState(false);
  const [showUserPicker, setShowUserPicker] = React.useState(false);
  const showPickerRef = React.useRef(showUserPicker);
  showPickerRef.current = showUserPicker;

  const pickerReasonRef = React.useRef<PickerReason>('no_stored_value');

  /** Evita que la hidratación desde AsyncStorage pise un emoji ya elegido en el gate. */
  const emojiTouchedRef = React.useRef<Record<User, boolean>>({
    diana: false,
    estefania: false,
  });
  /** Solo true mientras el picker está visible; al cerrar vuelve a false para detectar la próxima apertura. */
  const showUserPickerWasOpenRef = React.useRef(false);

  const emojiKeyForUser = React.useCallback((u: User) => `user_emoji_${u}`, []);
  const [userEmojiByUser, setUserEmojiByUser] = React.useState<Record<User, string>>({
    diana: DEFAULT_USER_EMOJI,
    estefania: DEFAULT_USER_EMOJI,
  });

  const markEmojiTouched = React.useCallback((u: User, emoji: string) => {
    emojiTouchedRef.current[u] = true;
    setUserEmojiByUser((prev) => ({ ...prev, [u]: emoji }));
  }, []);

  React.useEffect(() => {
    if (!showUserPicker) {
      showUserPickerWasOpenRef.current = false;
      return;
    }

    if (!success) return;

    const pickerJustOpened = !showUserPickerWasOpenRef.current;
    showUserPickerWasOpenRef.current = true;

    if (!pickerJustOpened) return;

    emojiTouchedRef.current = { diana: false, estefania: false };

    let cancelled = false;
    void (async () => {
      try {
        const [dianaRaw, estefaniaRaw] = await Promise.all([
          AsyncStorage.getItem(emojiKeyForUser('diana')),
          AsyncStorage.getItem(emojiKeyForUser('estefania')),
        ]);
        if (cancelled) return;
        setUserEmojiByUser((prev) => ({
          diana: emojiTouchedRef.current.diana ? prev.diana : dianaRaw || DEFAULT_USER_EMOJI,
          estefania: emojiTouchedRef.current.estefania
            ? prev.estefania
            : estefaniaRaw || DEFAULT_USER_EMOJI,
        }));
      } catch {
        // Fallback silencioso: no pisar filas ya tocadas por la usuaria.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [success, showUserPicker, emojiKeyForUser]);

  React.useEffect(() => {
    if (!success) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(SELECTED_USER_KEY);
        if (cancelled) return;
        const parsed = parseStoredUser(raw);
        if (parsed) {
          setUserState(parsed);
          posthog?.capture('selected_user_restored', { user: parsed });
        } else {
          pickerReasonRef.current = 'no_stored_value';
          setShowUserPicker(true);
          posthog?.capture('user_picker_shown', { reason: 'no_stored_value' });
        }
      } catch (e) {
        reportErrorToSentry(e, {
          domain: 'async_storage',
          operation: 'read',
          message: persistenceErrorMessage(e),
        });
        if (cancelled) return;
        pickerReasonRef.current = 'no_stored_value';
        setShowUserPicker(true);
        posthog?.capture('user_picker_shown', { reason: 'no_stored_value' });
      } finally {
        if (!cancelled) setUserHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [success, posthog]);

  const clearStoredUserAndShowPicker = React.useCallback(() => {
    const prev = userRef.current;
    void (async () => {
      try {
        await AsyncStorage.removeItem(SELECTED_USER_KEY);
        posthog?.capture('stored_user_cleared', { previous_user: prev });
        pickerReasonRef.current = 'manual_clear';
        setShowUserPicker(true);
        posthog?.capture('user_picker_shown', { reason: 'manual_clear' });
      } catch (e) {
        reportErrorToSentry(e, {
          domain: 'async_storage',
          operation: 'remove',
          message: persistenceErrorMessage(e),
        });
        pickerReasonRef.current = 'manual_clear';
        setShowUserPicker(true);
        posthog?.capture('user_picker_shown', { reason: 'manual_clear' });
      }
    })();
  }, [posthog]);

  const persistSetUser = React.useCallback(
    (u: User) => {
      const prev = userRef.current;
      if (prev === u) return;

      // Actualización optimista: evita que escrituras async desordenadas dejen un usuario viejo en pantalla.
      setUserState(u);

      void (async () => {
        try {
          await AsyncStorage.setItem(SELECTED_USER_KEY, u);
          if (userRef.current !== u) return;
          if (!showPickerRef.current) {
            posthog?.capture('user_switched_in_profile', { previous_user: prev, user: u });
          }
        } catch (e) {
          reportErrorToSentry(e, {
            domain: 'async_storage',
            operation: 'write',
            message: persistenceErrorMessage(e),
          });
          if (userRef.current === u) {
            setUserState(prev);
          }
        }
      })();
    },
    [posthog],
  );

  const completeGateSelection = React.useCallback(
    (u: User) => {
      const reason = pickerReasonRef.current;
      void (async () => {
        try {
          const emojiToSave = userEmojiByUser[u] || DEFAULT_USER_EMOJI;
          await AsyncStorage.setItem(emojiKeyForUser(u), emojiToSave);
          await AsyncStorage.setItem(SELECTED_USER_KEY, u);
          setUserState(u);
          setShowUserPicker(false);
          setActiveTab('home');
          posthog?.capture('user_picker_completed', { user: u, reason, persisted: true });
        } catch (e) {
          reportErrorToSentry(e, {
            domain: 'async_storage',
            operation: 'write',
            message: persistenceErrorMessage(e),
          });
          setUserState(u);
          setShowUserPicker(false);
          setActiveTab('home');
          posthog?.capture('user_picker_completed', { user: u, reason, persisted: false });
        }
      })();
    },
    [posthog, emojiKeyForUser, userEmojiByUser],
  );

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <MigrationFailureReporter error={error} />
        <View style={styles.screen}>
          <Text>Error en migraciones: {error.message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.screen}>
          <Text>Iniciando base de datos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!userHydrated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.screen}>
          <Text>Iniciando base de datos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <UserContext.Provider
      value={{ user, setUser: persistSetUser, clearStoredUserAndShowPicker }}
    >
      {!showUserPicker && <PostHogIdentifyUser user={user} />}
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />

        {showUserPicker ? (
          <View style={[styles.screen, styles.gateContent]}>
            <Text style={styles.gateTitle}>¿Quién usa la app?</Text>
            <Text style={styles.gateSubtitle}>Elige tu perfil para continuar</Text>
            <View style={styles.gateRow}>
              <View style={styles.gateUserStack}>
                <TouchableOpacity
                  style={styles.gateBtn}
                  onPress={() => completeGateSelection('diana')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.gateBtnText}>Diana</Text>
                </TouchableOpacity>
                <View style={styles.emojiPickerRow}>
                  {USER_EMOJIS.map((emoji) => {
                    const active = userEmojiByUser.diana === emoji;
                    return (
                      <TouchableOpacity
                        key={`diana-${emoji}`}
                        onPress={() => markEmojiTouched('diana', emoji)}
                        style={[styles.emojiChip, active && styles.emojiChipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.emojiChipText, active && styles.emojiChipTextActive]}>{emoji}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.gateUserStack}>
                <TouchableOpacity
                  style={styles.gateBtn}
                  onPress={() => completeGateSelection('estefania')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.gateBtnText}>Estefanía</Text>
                </TouchableOpacity>
                <View style={styles.emojiPickerRow}>
                  {USER_EMOJIS.map((emoji) => {
                    const active = userEmojiByUser.estefania === emoji;
                    return (
                      <TouchableOpacity
                        key={`estefania-${emoji}`}
                        onPress={() => markEmojiTouched('estefania', emoji)}
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
          </View>
        ) : (
          <>
            <View style={styles.screen}>
              {activeTab === 'home' && <Home onOpenSettings={() => setActiveTab('perfil')} />}
              {activeTab === 'stock' && <Stock user={user} />}
              {activeTab === 'comidas' && <MealPrep />}
              {activeTab === 'perfil' && (
                <Profile onBackToTabs={() => setActiveTab('home')} />
              )}
            </View>

            <View style={styles.tabBar}>
              {TABS.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.tab, active && styles.tabActive]}
                    onPress={() => setActiveTab(tab.key)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </SafeAreaView>
    </UserContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  screen: { flex: 1 },
  gateContent: { padding: 24, justifyContent: 'center', gap: 16 },
  gateTitle: { fontSize: 24, fontWeight: '700', color: '#222', textAlign: 'center' },
  gateSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 8 },
  gateRow: { flexDirection: 'row', gap: 12 },
  gateUserStack: { flex: 1 },
  gateBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#222',
    backgroundColor: '#fff',
    alignItems: 'center',
    width: '100%',
  },
  gateBtnText: { fontSize: 17, fontWeight: '600', color: '#222' },
  emojiPickerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
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
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: 12,
    gap: 8,
    backgroundColor: '#EDE8DF',
    borderTopWidth: 1,
    borderTopColor: '#E0D9CE',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#C97B6E',
  },
  tabLabel: { fontSize: 12, color: '#7A756D', fontWeight: '600' },
  tabLabelActive: { color: '#FFFFFF' },
});

export default sentryDsn ? Sentry.wrap(App) : App;
