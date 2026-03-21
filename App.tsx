import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { usePostHog } from 'posthog-react-native';
import { db } from './src/db';
import migrations from './src/db/migrations/migrations';
import Home from './src/screens/Home';
import Checklist from './src/screens/Checklist';
import Stock from './src/screens/Stock';
import MealPrep from './src/screens/MealPrep';
import Profile from './src/screens/Profile';
import { UserContext } from './src/context/UserContext';
import type { User } from './src/context/UserContext';

const SELECTED_USER_KEY = 'selected_user';

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
  const posthog = usePostHog();
  const reported = React.useRef(false);
  React.useEffect(() => {
    if (reported.current || !posthog) return;
    reported.current = true;
    posthog.capture('migration_failed', {
      message: error.message,
      error_name: error.name,
    });
  }, [posthog, error]);
  return null;
}

type Tab = 'home' | 'checklist' | 'stock' | 'comidas' | 'perfil';

const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Inicio' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'stock', label: 'Stock' },
  { key: 'comidas', label: 'Comidas' },
  { key: 'perfil', label: 'Perfil' },
];

export default function App() {
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
        posthog?.capture('user_persistence_failed', {
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
        posthog?.capture('user_persistence_failed', {
          operation: 'remove',
          message: persistenceErrorMessage(e),
        });
      }
    })();
  }, [posthog]);

  const persistSetUser = React.useCallback(
    (u: User) => {
      const prev = userRef.current;
      void (async () => {
        try {
          await AsyncStorage.setItem(SELECTED_USER_KEY, u);
          setUserState(u);
          if (!showPickerRef.current && prev !== u) {
            posthog?.capture('user_switched_in_profile', { previous_user: prev, user: u });
          }
        } catch (e) {
          posthog?.capture('user_persistence_failed', {
            operation: 'write',
            message: persistenceErrorMessage(e),
          });
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
          await AsyncStorage.setItem(SELECTED_USER_KEY, u);
          setUserState(u);
          setShowUserPicker(false);
          setActiveTab('home');
          posthog?.capture('user_picker_completed', { user: u, reason });
        } catch (e) {
          posthog?.capture('user_persistence_failed', {
            operation: 'write',
            message: persistenceErrorMessage(e),
          });
        }
      })();
    },
    [posthog],
  );

  if (error) {
    console.error('Migration error full:', error);
    console.error('Migration error message:', error.message);
    console.error('Migration error stack:', error.stack);
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
              <TouchableOpacity
                style={styles.gateBtn}
                onPress={() => completeGateSelection('diana')}
                activeOpacity={0.7}
              >
                <Text style={styles.gateBtnText}>Diana</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gateBtn}
                onPress={() => completeGateSelection('estefania')}
                activeOpacity={0.7}
              >
                <Text style={styles.gateBtnText}>Estefanía</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.screen}>
              {activeTab === 'home' && <Home />}
              {activeTab === 'checklist' && <Checklist />}
              {activeTab === 'stock' && <Stock user={user} />}
              {activeTab === 'comidas' && <MealPrep />}
              {activeTab === 'perfil' && <Profile />}
            </View>

            <View style={styles.tabBar}>
              {TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={styles.tab}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  {activeTab === tab.key && <View style={styles.tabIndicator} />}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </SafeAreaView>
    </UserContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  screen: { flex: 1 },
  gateContent: { padding: 24, justifyContent: 'center', gap: 16 },
  gateTitle: { fontSize: 24, fontWeight: '700', color: '#222', textAlign: 'center' },
  gateSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 8 },
  gateRow: { flexDirection: 'row', gap: 12 },
  gateBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#222',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  gateBtnText: { fontSize: 17, fontWeight: '600', color: '#222' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabLabel: { fontSize: 13, color: '#AAA', fontWeight: '500' },
  tabLabelActive: { color: '#222' },
  tabIndicator: {
    height: 3,
    width: 24,
    backgroundColor: '#222',
    borderRadius: 2,
    marginTop: 4,
  },
});
