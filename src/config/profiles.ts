import type { SupplementPersona } from '../types';
import { isPhaseHeaderWord } from '../utils/notionTemplateMatch';

export const MAX_PROFILES = 2 as const;

export const PROFILES = [
  { id: 'profile_1', label: 'Perfil 1', emojiDefault: '🌿' },
  { id: 'profile_2', label: 'Perfil 2', emojiDefault: '🌸' },
] as const;

export type ProfileId = (typeof PROFILES)[number]['id'];

/** @deprecated Legacy AsyncStorage / SQLite values — migrated on startup. */
export const LEGACY_PROFILE_IDS = ['diana', 'estefania'] as const;
export type LegacyProfileId = (typeof LEGACY_PROFILE_IDS)[number];

const LEGACY_TO_PROFILE: Record<LegacyProfileId, ProfileId> = {
  diana: 'profile_1',
  estefania: 'profile_2',
};

/** Default Notion mapping (template with Persona Diana / Estefanía). Override via `profiles.local.ts`. */
const DEFAULT_NOTION_BY_PROFILE: Record<
  ProfileId,
  { supplementPersona: SupplementPersona; phaseRowLabel: string }
> = {
  profile_1: { supplementPersona: 'Diana', phaseRowLabel: 'Diana' },
  profile_2: { supplementPersona: 'Estefanía', phaseRowLabel: 'Estefanía' },
};

export type ProfileOverrides = {
  profileLabels?: Partial<Record<ProfileId, string>>;
  notionByProfile?: Partial<
    Record<ProfileId, { supplementPersona?: SupplementPersona; phaseRowLabel?: string }>
  >;
};

let localOverrides: ProfileOverrides = {};

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const local = require('./profiles.local') as { PROFILE_OVERRIDES?: ProfileOverrides };
  if (local?.PROFILE_OVERRIDES) {
    localOverrides = local.PROFILE_OVERRIDES;
  }
} catch {
  // Optional gitignored file — defaults only.
}

// ─── Overrides runtime (onboarding / Perfil) ─────────────────────────────────
// Prioridad: profiles.local.ts (build, forks/dev) > runtime (AsyncStorage) > defaults.

const RUNTIME_OVERRIDES_KEY = 'profile_overrides_v1';

let runtimeOverrides: ProfileOverrides = {};
const overrideListeners = new Set<() => void>();

function notifyOverrideListeners(): void {
  for (const cb of overrideListeners) cb();
}

/** Re-render de componentes que leen labels/personas vía getters sync. */
export function subscribeProfileOverrides(cb: () => void): () => void {
  overrideListeners.add(cb);
  return () => overrideListeners.delete(cb);
}

/**
 * Repara overrides guardados por versiones con el bug de fila de encabezado
 * (perfil mapeado a «Persona»): descarta slots con palabra de header y
 * recorre los sobrevivientes hacia arriba (slot 1 primero).
 */
export function sanitizeProfileOverrides(overrides: ProfileOverrides): {
  next: ProfileOverrides;
  changed: boolean;
} {
  const survivors: { label?: string; persona?: string; phaseRow?: string }[] = [];
  let dropped = false;
  for (const p of PROFILES) {
    const label = overrides.profileLabels?.[p.id];
    const notion = overrides.notionByProfile?.[p.id];
    const hasAny = label != null || notion != null;
    if (!hasAny) continue;
    const headerish =
      (label != null && isPhaseHeaderWord(label)) ||
      (notion?.supplementPersona != null && isPhaseHeaderWord(notion.supplementPersona)) ||
      (notion?.phaseRowLabel != null && isPhaseHeaderWord(notion.phaseRowLabel));
    if (headerish) {
      dropped = true;
      continue;
    }
    survivors.push({
      label,
      persona: notion?.supplementPersona,
      phaseRow: notion?.phaseRowLabel,
    });
  }
  if (!dropped) return { next: overrides, changed: false };

  const next: ProfileOverrides = { profileLabels: {}, notionByProfile: {} };
  PROFILES.forEach((p, i) => {
    const s = survivors[i];
    if (!s) return;
    if (s.label != null) next.profileLabels![p.id] = s.label;
    if (s.persona != null || s.phaseRow != null) {
      next.notionByProfile![p.id] = {
        ...(s.persona != null ? { supplementPersona: s.persona } : {}),
        ...(s.phaseRow != null ? { phaseRowLabel: s.phaseRow } : {}),
      };
    }
  });
  return { next, changed: true };
}

/** Hidrata overrides runtime desde el dispositivo; llamar una vez en el boot. */
export async function loadProfileOverrides(): Promise<void> {
  // Import perezoso: mantiene profiles.ts importable en tests sin native storage.
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  try {
    const raw = await AsyncStorage.getItem(RUNTIME_OVERRIDES_KEY);
    const loaded = raw ? (JSON.parse(raw) as ProfileOverrides) : {};
    const { next, changed } = sanitizeProfileOverrides(loaded);
    runtimeOverrides = next;
    if (changed) {
      await AsyncStorage.setItem(RUNTIME_OVERRIDES_KEY, JSON.stringify(next)).catch(() => {});
    }
  } catch {
    runtimeOverrides = {};
  }
  notifyOverrideListeners();
}

export async function saveProfileOverrides(next: ProfileOverrides): Promise<void> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  runtimeOverrides = next;
  notifyOverrideListeners();
  await AsyncStorage.setItem(RUNTIME_OVERRIDES_KEY, JSON.stringify(next));
}

export function getProfileOverrides(): ProfileOverrides {
  return runtimeOverrides;
}

/** Solo tests: fija overrides runtime sin tocar storage. */
export function __setRuntimeProfileOverridesForTests(next: ProfileOverrides): void {
  runtimeOverrides = next;
  notifyOverrideListeners();
}

/**
 * Overrides derivados de las personas de la tabla de fases detectada en el
 * onboarding: cada fila mapea a un slot (label mostrado = persona en Notion).
 */
export function overridesFromPhaseRowLabels(labels: string[]): ProfileOverrides {
  // Defensa extra: nunca mapear palabras de encabezado como personas.
  const cleanLabels = labels.map((l) => l?.trim()).filter((l) => l && !isPhaseHeaderWord(l));
  const next: ProfileOverrides = { profileLabels: {}, notionByProfile: {} };
  PROFILES.forEach((profile, i) => {
    const label = cleanLabels[i];
    if (!label) return;
    next.profileLabels![profile.id] = label;
    next.notionByProfile![profile.id] = { supplementPersona: label, phaseRowLabel: label };
  });
  return next;
}

export function isProfileId(value: string): value is ProfileId {
  return value === 'profile_1' || value === 'profile_2';
}

export function migrateLegacyProfileId(raw: string | null): ProfileId | null {
  if (!raw) return null;
  if (isProfileId(raw)) return raw;
  if (raw === 'diana' || raw === 'estefania') return LEGACY_TO_PROFILE[raw];
  return null;
}

export function getProfileLabel(id: ProfileId): string {
  return (
    localOverrides.profileLabels?.[id] ??
    runtimeOverrides.profileLabels?.[id] ??
    PROFILES.find((p) => p.id === id)?.label ??
    id
  );
}

export function getNotionSupplementPersona(id: ProfileId): SupplementPersona {
  return (
    localOverrides.notionByProfile?.[id]?.supplementPersona ??
    runtimeOverrides.notionByProfile?.[id]?.supplementPersona ??
    DEFAULT_NOTION_BY_PROFILE[id].supplementPersona
  );
}

/** Label in the Notion fases table (column Persona), matched after normalizePersonName. */
export function getNotionPhaseRowLabel(id: ProfileId): string {
  return (
    localOverrides.notionByProfile?.[id]?.phaseRowLabel ??
    runtimeOverrides.notionByProfile?.[id]?.phaseRowLabel ??
    DEFAULT_NOTION_BY_PROFILE[id].phaseRowLabel
  );
}

export function profileIdsRecord<T>(factory: (id: ProfileId) => T): Record<ProfileId, T> {
  return {
    profile_1: factory('profile_1'),
    profile_2: factory('profile_2'),
  };
}
