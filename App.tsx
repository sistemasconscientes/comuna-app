import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from './src/db';
import migrations from './src/db/migrations/migrations';
import Home from './src/screens/Home';
import Checklist from './src/screens/Checklist';
import Stock from './src/screens/Stock';
import Profile from './src/screens/Profile';
import { UserContext } from './src/context/UserContext';
import type { User } from './src/context/UserContext';

type Tab = 'home' | 'checklist' | 'stock' | 'perfil';

const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Inicio' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'stock', label: 'Stock' },
  { key: 'perfil', label: 'Perfil' },
];

export default function App() {
  const { success, error } = useMigrations(db, migrations);
  const [activeTab, setActiveTab] = React.useState<Tab>('home');
  const [user, setUser] = React.useState<User>('diana');

  if (error) {
    console.error('Migration error full:', error);
    console.error('Migration error message:', error.message);
    console.error('Migration error stack:', error.stack);
    return (
      <SafeAreaView style={styles.container}>
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

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />

        <View style={styles.screen}>
          {activeTab === 'home' && <Home />}
          {activeTab === 'checklist' && <Checklist />}
          {activeTab === 'stock' && <Stock user={user} />}
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
      </SafeAreaView>
    </UserContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  screen: { flex: 1 },
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
