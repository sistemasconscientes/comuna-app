import type { ProfileId } from './profiles';

/**
 * Copiar a `profiles.local.ts` (gitignored) para labels y mapeo Notion personalizados.
 */
export const PROFILE_OVERRIDES = {
  profileLabels: {
    profile_1: 'Diana',
    profile_2: 'Estefanía',
  } satisfies Partial<Record<ProfileId, string>>,
  notionByProfile: {
    profile_1: { supplementPersona: 'Diana' as const, phaseRowLabel: 'Diana' },
    profile_2: { supplementPersona: 'Estefanía' as const, phaseRowLabel: 'Estefanía' },
  },
};
