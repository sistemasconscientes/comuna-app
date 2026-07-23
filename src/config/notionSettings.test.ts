/**
 * Cascada de settings de Notion: guardado en dispositivo → `.env` → none.
 * En tests `.env` está vacío, así que el fallback env equivale a `none`.
 */

import {
  __resetNotionSettingsForTests,
  clearNotionSettings,
  enableDemoMode,
  getNotionSettings,
  getNotionSettingsSource,
  isDemoMode,
  isNotionConfigured,
  loadNotionSettings,
  saveNotionSettings,
} from './notionSettings';

const mockSecureStore = new Map<string, string>();
const mockAsyncStorage = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockSecureStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockSecureStore.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockSecureStore.delete(k);
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockAsyncStorage.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mockAsyncStorage.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      mockAsyncStorage.delete(k);
    }),
  },
}));

const SETTINGS = {
  apiKey: 'ntn_token',
  supplementsDbId: 'db-sup',
  phasesPageId: 'pg-fases',
  mealPrepHubPageId: 'pg-hub',
  teasDbId: 'db-teas',
};

beforeEach(() => {
  mockSecureStore.clear();
  mockAsyncStorage.clear();
  __resetNotionSettingsForTests();
});

describe('notionSettings', () => {
  it('sin nada guardado ni env queda en none', async () => {
    expect(await loadNotionSettings()).toBe('none');
    expect(isNotionConfigured()).toBe(false);
    expect(getNotionSettings().apiKey).toBe('');
  });

  it('guardar persiste, actualiza el snapshot y separa token de IDs', async () => {
    await saveNotionSettings(SETTINGS);
    expect(getNotionSettingsSource()).toBe('stored');
    expect(getNotionSettings()).toEqual(SETTINGS);
    // Token solo en el llavero; IDs solo en AsyncStorage.
    expect([...mockSecureStore.values()].join()).toContain('ntn_token');
    const asyncBlob = [...mockAsyncStorage.values()].join();
    expect(asyncBlob).not.toContain('ntn_token');
    expect(asyncBlob).toContain('db-sup');
  });

  it('hidrata lo guardado en un arranque posterior', async () => {
    await saveNotionSettings(SETTINGS);
    __resetNotionSettingsForTests();
    expect(await loadNotionSettings()).toBe('stored');
    expect(getNotionSettings().phasesPageId).toBe('pg-fases');
  });

  it('storage incompleto (sin IDs requeridos) cae al fallback', async () => {
    await saveNotionSettings(SETTINGS);
    mockAsyncStorage.clear();
    __resetNotionSettingsForTests();
    expect(await loadNotionSettings()).toBe('none');
  });

  it('storage corrupto no revienta la hidratación', async () => {
    mockSecureStore.set('notion_api_key', 'ntn_token');
    mockAsyncStorage.set('notion_settings_v1', '{no-json');
    expect(await loadNotionSettings()).toBe('none');
  });

  it('desconectar borra token e IDs y vuelve a none', async () => {
    await saveNotionSettings(SETTINGS);
    await clearNotionSettings();
    expect(getNotionSettingsSource()).toBe('none');
    expect(mockSecureStore.size).toBe(0);
    expect(mockAsyncStorage.size).toBe(0);
  });

  it('modo demo persiste entre arranques y se apaga al conectar de verdad', async () => {
    await enableDemoMode();
    expect(isDemoMode()).toBe(true);
    __resetNotionSettingsForTests();
    expect(await loadNotionSettings()).toBe('demo');
    await saveNotionSettings(SETTINGS);
    expect(getNotionSettingsSource()).toBe('stored');
    __resetNotionSettingsForTests();
    expect(await loadNotionSettings()).toBe('stored');
  });

  it('salir del modo demo vuelve a none', async () => {
    await enableDemoMode();
    await clearNotionSettings();
    expect(getNotionSettingsSource()).toBe('none');
    __resetNotionSettingsForTests();
    expect(await loadNotionSettings()).toBe('none');
  });

  it('rechaza settings incompletos al guardar', async () => {
    await expect(saveNotionSettings({ ...SETTINGS, supplementsDbId: '  ' })).rejects.toThrow(
      'incompletos',
    );
  });
});
