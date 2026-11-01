/**
 * Preferencias de interfaz por teléfono (enfoque neurodivergente):
 * - `simpleMode`: Inicio muestra solo lo del día (energía + lista); oculta té,
 *   barra de fase y textos secundarios.
 */
export interface UiPrefs {
  simpleMode: boolean;
}

const KEY = 'ui_prefs_v1';
const DEFAULTS: UiPrefs = { simpleMode: false };

let prefs: UiPrefs = { ...DEFAULTS };
const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of listeners) cb();
}

export function getUiPrefs(): UiPrefs {
  return prefs;
}

export async function loadUiPrefs(): Promise<void> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  try {
    const raw = await AsyncStorage.getItem(KEY);
    prefs = { ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<UiPrefs>) : {}) };
  } catch {
    prefs = { ...DEFAULTS };
  }
  notify();
}

export async function setUiPref<K extends keyof UiPrefs>(key: K, value: UiPrefs[K]): Promise<void> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  prefs = { ...prefs, [key]: value };
  notify();
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}

/** Suscripción para `useUiPrefs` (src/hooks). */
export function subscribeUiPrefs(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
