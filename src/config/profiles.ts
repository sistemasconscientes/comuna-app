import type { SupplementPersona } from '../types';

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

type LocalOverrides = {
  profileLabels?: Partial<Record<ProfileId, string>>;
  notionByProfile?: Partial<
    Record<ProfileId, { supplementPersona?: SupplementPersona; phaseRowLabel?: string }>
  >;
};

let localOverrides: LocalOverrides = {};

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const local = require('./profiles.local') as { PROFILE_OVERRIDES?: LocalOverrides };
  if (local?.PROFILE_OVERRIDES) {
    localOverrides = local.PROFILE_OVERRIDES;
  }
} catch {
  // Optional gitignored file — defaults only.
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
  return localOverrides.profileLabels?.[id] ?? PROFILES.find((p) => p.id === id)?.label ?? id;
}

export function getNotionSupplementPersona(id: ProfileId): SupplementPersona {
  const o = localOverrides.notionByProfile?.[id]?.supplementPersona;
  if (o) return o;
  return DEFAULT_NOTION_BY_PROFILE[id].supplementPersona;
}

/** Label in the Notion fases table (column Persona), matched after normalizePersonName. */
export function getNotionPhaseRowLabel(id: ProfileId): string {
  const o = localOverrides.notionByProfile?.[id]?.phaseRowLabel;
  if (o) return o;
  return DEFAULT_NOTION_BY_PROFILE[id].phaseRowLabel;
}

export function profileIdsRecord<T>(factory: (id: ProfileId) => T): Record<ProfileId, T> {
  return {
    profile_1: factory('profile_1'),
    profile_2: factory('profile_2'),
  };
}
