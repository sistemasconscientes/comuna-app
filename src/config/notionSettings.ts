import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  NOTION_API_KEY,
  NOTION_MEAL_PREP_HUB_PAGE_ID,
  NOTION_PHASES_PAGE_ID,
  NOTION_SUPPLEMENTS_DB_ID,
} from '@env';

/**
 * Config de Notion resuelta en runtime. Cascada: guardada en dispositivo
 * (onboarding in-app) → `.env` de build (forks / desarrollo). El token va al
 * llavero (SecureStore); los IDs, a AsyncStorage.
 */
export interface NotionSettings {
  apiKey: string;
  supplementsDbId: string;
  phasesPageId: string;
  /** Vacío ⇒ pestaña Comidas sin plan (`getMealPrep` → null). */
  mealPrepHubPageId: string;
  /** Vacío ⇒ sin tés (o el default de env para el setup del maintainer). */
  teasDbId: string;
}

export type NotionSettingsSource = 'stored' | 'env' | 'none';

const SECURE_TOKEN_KEY = 'notion_api_key';
const STORAGE_IDS_KEY = 'notion_settings_v1';

type StoredIds = Omit<NotionSettings, 'apiKey'>;

function envSettings(): NotionSettings {
  return {
    apiKey: (NOTION_API_KEY ?? '').trim(),
    supplementsDbId: (NOTION_SUPPLEMENTS_DB_ID ?? '').trim(),
    phasesPageId: (NOTION_PHASES_PAGE_ID ?? '').trim(),
    mealPrepHubPageId: (NOTION_MEAL_PREP_HUB_PAGE_ID ?? '').trim(),
    teasDbId: '',
  };
}

function isComplete(s: { apiKey: string; supplementsDbId: string; phasesPageId: string }): boolean {
  return Boolean(s.apiKey && s.supplementsDbId && s.phasesPageId);
}

let snapshot: NotionSettings = envSettings();
let snapshotSource: NotionSettingsSource = isComplete(snapshot) ? 'env' : 'none';
let hydrated = false;

/**
 * Hidrata el snapshot desde el dispositivo. Llamar una vez en el boot (App)
 * antes de usar la API de Notion; sin settings guardados cae a `.env`.
 */
export async function loadNotionSettings(): Promise<NotionSettingsSource> {
  try {
    const [token, rawIds] = await Promise.all([
      SecureStore.getItemAsync(SECURE_TOKEN_KEY),
      AsyncStorage.getItem(STORAGE_IDS_KEY),
    ]);
    if (token && rawIds) {
      const ids = JSON.parse(rawIds) as Partial<StoredIds>;
      const stored: NotionSettings = {
        apiKey: token.trim(),
        supplementsDbId: (ids.supplementsDbId ?? '').trim(),
        phasesPageId: (ids.phasesPageId ?? '').trim(),
        mealPrepHubPageId: (ids.mealPrepHubPageId ?? '').trim(),
        teasDbId: (ids.teasDbId ?? '').trim(),
      };
      if (isComplete(stored)) {
        snapshot = stored;
        snapshotSource = 'stored';
        hydrated = true;
        return snapshotSource;
      }
    }
  } catch {
    // Storage ilegible (JSON corrupto, llavero inaccesible): caer a env.
  }
  snapshot = envSettings();
  snapshotSource = isComplete(snapshot) ? 'env' : 'none';
  hydrated = true;
  return snapshotSource;
}

/** Snapshot actual (sync, para el cliente de Notion). Vacíos si `source === 'none'`. */
export function getNotionSettings(): NotionSettings {
  return snapshot;
}

export function getNotionSettingsSource(): NotionSettingsSource {
  return snapshotSource;
}

export function isNotionSettingsHydrated(): boolean {
  return hydrated;
}

export function isNotionConfigured(): boolean {
  return snapshotSource !== 'none';
}

/** Persiste settings del onboarding y actualiza el snapshot en memoria. */
export async function saveNotionSettings(settings: NotionSettings): Promise<void> {
  const clean: NotionSettings = {
    apiKey: settings.apiKey.trim(),
    supplementsDbId: settings.supplementsDbId.trim(),
    phasesPageId: settings.phasesPageId.trim(),
    mealPrepHubPageId: settings.mealPrepHubPageId.trim(),
    teasDbId: settings.teasDbId.trim(),
  };
  if (!isComplete(clean)) throw new Error('Notion settings incompletos');
  const ids: StoredIds = {
    supplementsDbId: clean.supplementsDbId,
    phasesPageId: clean.phasesPageId,
    mealPrepHubPageId: clean.mealPrepHubPageId,
    teasDbId: clean.teasDbId,
  };
  await SecureStore.setItemAsync(SECURE_TOKEN_KEY, clean.apiKey);
  await AsyncStorage.setItem(STORAGE_IDS_KEY, JSON.stringify(ids));
  snapshot = clean;
  snapshotSource = 'stored';
}

/** Borra el token y los IDs guardados; vuelve a `.env` si existe, o a `none`. */
export async function clearNotionSettings(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY).catch(() => {});
  await AsyncStorage.removeItem(STORAGE_IDS_KEY).catch(() => {});
  snapshot = envSettings();
  snapshotSource = isComplete(snapshot) ? 'env' : 'none';
}

/** Solo tests: resetea el estado del módulo. */
export function __resetNotionSettingsForTests(): void {
  snapshot = envSettings();
  snapshotSource = isComplete(snapshot) ? 'env' : 'none';
  hydrated = false;
}
