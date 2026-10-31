import type { SupplementPersona } from '../types';
import { isPhaseHeaderWord } from '../utils/notionTemplateMatch';

/** Tope de perfiles por dispositivo (hogar / roomies). */
export const MAX_PROFILES = 8 as const;

/** Perfiles al instalar, antes de detectar personas en Notion. */
export const DEFAULT_PROFILE_COUNT = 2;

export type ProfileId = `profile_${number}`;

export interface ProfileSlot {
  id: ProfileId;
  label: string;
  emojiDefault: string;
}

const DEFAULT_EMOJIS = ['🌿', '🌸', '🦋', '🌙', '✨', '🔮', '🌺', '🍄'] as const;

/**
 * Valores del select **Persona** que significan «para todo el hogar» (stock
 * compartido). `Ambas` es el del template original; `Compartido` el del
 * template multi-persona.
 */
export const SHARED_PERSONA_VALUES = ['Compartido', 'Ambas', 'Todas', 'Todos'] as const;

export function isSharedPersona(persona: string | null | undefined): boolean {
  const n = (persona ?? '').trim().toLowerCase();
  return SHARED_PERSONA_VALUES.some((v) => v.toLowerCase() === n);
}

/** @deprecated Legacy AsyncStorage / SQLite values — migrated on startup. */
export const LEGACY_PROFILE_IDS = ['diana', 'estefania'] as const;
export type LegacyProfileId = (typeof LEGACY_PROFILE_IDS)[number];

const LEGACY_TO_PROFILE: Record<LegacyProfileId, ProfileId> = {
  diana: 'profile_1',
  estefania: 'profile_2',
};

/** Default Notion mapping (template with Persona Diana / Estefanía). Override via `profiles.local.ts`. */
const DEFAULT_NOTION_BY_PROFILE: Partial<
  Record<ProfileId, { supplementPersona: SupplementPersona; phaseRowLabel: string }>
> = {
  profile_1: { supplementPersona: 'Diana', phaseRowLabel: 'Diana' },
  profile_2: { supplementPersona: 'Estefanía', phaseRowLabel: 'Estefanía' },
};

export type ProfileOverrides = {
  /** Cantidad de perfiles activos (1…MAX_PROFILES). */
  profileCount?: number;
  profileLabels?: Partial<Record<ProfileId, string>>;
  notionByProfile?: Partial<
    Record<ProfileId, { supplementPersona?: SupplementPersona; phaseRowLabel?: string }>
  >;
  /** `false` = la persona no sigue ciclo menstrual (sin fases, sin HealthKit de ciclo). */
  cycleByProfile?: Partial<Record<ProfileId, boolean>>;
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

export function profileIdAt(index: number): ProfileId {
  return `profile_${index + 1}`;
}

/** Índice 0-based del slot, o -1 si el id no tiene forma de perfil. */
export function profileIndex(id: string): number {
  const m = /^profile_([1-9]\d*)$/.exec(id);
  return m ? Number(m[1]) - 1 : -1;
}

function clampCount(n: number | undefined): number | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  return Math.min(MAX_PROFILES, Math.max(1, Math.round(n)));
}

export function getProfileCount(): number {
  return (
    clampCount(localOverrides.profileCount) ??
    clampCount(runtimeOverrides.profileCount) ??
    DEFAULT_PROFILE_COUNT
  );
}

export function getProfiles(): ProfileSlot[] {
  return Array.from({ length: getProfileCount() }, (_, i) => ({
    id: profileIdAt(i),
    label: `Perfil ${i + 1}`,
    emojiDefault: DEFAULT_EMOJIS[i % DEFAULT_EMOJIS.length],
  }));
}

export function getDefaultEmoji(id: ProfileId): string {
  const i = Math.max(0, profileIndex(id));
  return DEFAULT_EMOJIS[i % DEFAULT_EMOJIS.length];
}

type SlotData = {
  label?: string;
  persona?: string;
  phaseRow?: string;
  cycle?: boolean;
};

function slotData(overrides: ProfileOverrides, id: ProfileId): SlotData | null {
  const label = overrides.profileLabels?.[id];
  const notion = overrides.notionByProfile?.[id];
  const cycle = overrides.cycleByProfile?.[id];
  if (label == null && notion == null && cycle == null) return null;
  return {
    label,
    persona: notion?.supplementPersona,
    phaseRow: notion?.phaseRowLabel,
    cycle,
  };
}

function overridesFromSlots(slots: SlotData[], profileCount?: number): ProfileOverrides {
  const next: ProfileOverrides = { profileLabels: {}, notionByProfile: {}, cycleByProfile: {} };
  if (profileCount != null) next.profileCount = profileCount;
  slots.forEach((s, i) => {
    const id = profileIdAt(i);
    if (s.label != null) next.profileLabels![id] = s.label;
    if (s.persona != null || s.phaseRow != null) {
      next.notionByProfile![id] = {
        ...(s.persona != null ? { supplementPersona: s.persona } : {}),
        ...(s.phaseRow != null ? { phaseRowLabel: s.phaseRow } : {}),
      };
    }
    if (s.cycle != null) next.cycleByProfile![id] = s.cycle;
  });
  return next;
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
  const survivors: SlotData[] = [];
  let dropped = 0;
  for (let i = 0; i < MAX_PROFILES; i++) {
    const s = slotData(overrides, profileIdAt(i));
    if (!s) continue;
    const headerish =
      (s.label != null && isPhaseHeaderWord(s.label)) ||
      (s.persona != null && isPhaseHeaderWord(s.persona)) ||
      (s.phaseRow != null && isPhaseHeaderWord(s.phaseRow));
    if (headerish) {
      dropped++;
      continue;
    }
    survivors.push(s);
  }
  if (!dropped) return { next: overrides, changed: false };

  const count =
    overrides.profileCount != null ? Math.max(1, overrides.profileCount - dropped) : undefined;
  return { next: overridesFromSlots(survivors, count), changed: true };
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

function cleanPersonaLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const l = raw?.trim();
    // Defensa extra: nunca mapear palabras de encabezado ni la opción compartida.
    if (!l || isPhaseHeaderWord(l) || isSharedPersona(l)) continue;
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

/**
 * Overrides derivados de las personas detectadas en Notion: primero las filas
 * de la tabla de fases (siguen ciclo), luego las personas que solo aparecen en
 * el select Persona de Suplementos (sin ciclo). Label mostrado = persona.
 */
export function overridesFromDetectedPersonas(
  cycleLabels: string[],
  noCycleLabels: string[] = [],
): ProfileOverrides {
  const cycle = cleanPersonaLabels(cycleLabels);
  const cycleKeys = new Set(cycle.map((l) => l.toLowerCase()));
  const noCycle = cleanPersonaLabels(noCycleLabels).filter((l) => !cycleKeys.has(l.toLowerCase()));
  const slots: SlotData[] = [
    ...cycle.map((l) => ({ label: l, persona: l, phaseRow: l, cycle: true })),
    ...noCycle.map((l) => ({ label: l, persona: l, phaseRow: l, cycle: false })),
  ].slice(0, MAX_PROFILES);
  return overridesFromSlots(slots, slots.length ? slots.length : undefined);
}

/** Compat: solo filas de la tabla de fases. */
export function overridesFromPhaseRowLabels(labels: string[]): ProfileOverrides {
  return overridesFromDetectedPersonas(labels);
}

/** Agrega un perfil al final; devuelve su id o null si ya se llegó al tope. */
export async function addProfile(): Promise<ProfileId | null> {
  const count = getProfileCount();
  if (count >= MAX_PROFILES) return null;
  await saveProfileOverrides({ ...runtimeOverrides, profileCount: count + 1 });
  return profileIdAt(count);
}

/**
 * Quita el último perfil (los ids son posicionales: quitar uno del medio
 * reasignaría registros locales de otra persona). Sus registros locales quedan
 * en SQLite por si se vuelve a agregar.
 */
export async function removeLastProfile(): Promise<void> {
  const count = getProfileCount();
  if (count <= 1) return;
  const last = profileIdAt(count - 1);
  const { [last]: _l, ...profileLabels } = runtimeOverrides.profileLabels ?? {};
  const { [last]: _n, ...notionByProfile } = runtimeOverrides.notionByProfile ?? {};
  const { [last]: _c, ...cycleByProfile } = runtimeOverrides.cycleByProfile ?? {};
  await saveProfileOverrides({
    profileCount: count - 1,
    profileLabels,
    notionByProfile,
    cycleByProfile,
  });
}

export function isProfileId(value: string): value is ProfileId {
  const i = profileIndex(value);
  return i >= 0 && i < MAX_PROFILES;
}

/** Perfil existente con la cantidad actual de perfiles. */
export function isActiveProfileId(value: string): value is ProfileId {
  const i = profileIndex(value);
  return i >= 0 && i < getProfileCount();
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
    (profileIndex(id) >= 0 ? `Perfil ${profileIndex(id) + 1}` : id)
  );
}

export function getNotionSupplementPersona(id: ProfileId): SupplementPersona {
  return (
    localOverrides.notionByProfile?.[id]?.supplementPersona ??
    runtimeOverrides.notionByProfile?.[id]?.supplementPersona ??
    DEFAULT_NOTION_BY_PROFILE[id]?.supplementPersona ??
    getProfileLabel(id)
  );
}

/** Label in the Notion fases table (column Persona), matched after normalizePersonName. */
export function getNotionPhaseRowLabel(id: ProfileId): string {
  return (
    localOverrides.notionByProfile?.[id]?.phaseRowLabel ??
    runtimeOverrides.notionByProfile?.[id]?.phaseRowLabel ??
    DEFAULT_NOTION_BY_PROFILE[id]?.phaseRowLabel ??
    getProfileLabel(id)
  );
}

/** ¿La persona sigue ciclo menstrual? (fases, HealthKit de ciclo, sync de fase a Notion). */
export function profileTracksCycle(id: ProfileId): boolean {
  return localOverrides.cycleByProfile?.[id] ?? runtimeOverrides.cycleByProfile?.[id] ?? true;
}

export async function setProfileTracksCycle(id: ProfileId, tracks: boolean): Promise<void> {
  await saveProfileOverrides({
    ...runtimeOverrides,
    cycleByProfile: { ...runtimeOverrides.cycleByProfile, [id]: tracks },
  });
}

export function profileIdsRecord<T>(factory: (id: ProfileId) => T): Record<ProfileId, T> {
  const out = {} as Record<ProfileId, T>;
  for (const p of getProfiles()) out[p.id] = factory(p.id);
  return out;
}
