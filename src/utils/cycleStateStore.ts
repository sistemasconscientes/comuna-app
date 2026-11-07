import * as SecureStore from 'expo-secure-store';
import { eq } from 'drizzle-orm';
import { db, cycleStates } from '../db';
import type { ProfileId } from '../config/profiles';

/**
 * Última fecha de inicio de periodo por perfil (fallback si HealthKit no
 * responde). Va al llavero con `*_THIS_DEVICE_ONLY`: no entra en el backup de
 * iCloud ni migra a otro dispositivo (guideline 5.1.3(ii)). Hasta 1.2.1 vivía
 * en SQLite (`cycle_states`, sin cifrar y respaldado); `loadLastPeriodStart`
 * lo mueve al llavero y borra la fila.
 */
const KEY_PREFIX = 'cycle_last_period_start_';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

function keyFor(user: ProfileId): string {
  return `${KEY_PREFIX}${user}`;
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveLastPeriodStart(user: ProfileId, start: Date): Promise<void> {
  await SecureStore.setItemAsync(keyFor(user), start.toISOString(), OPTIONS);
}

export async function loadLastPeriodStart(user: ProfileId): Promise<Date | null> {
  const stored = parseDate(await SecureStore.getItemAsync(keyFor(user), OPTIONS));

  const legacyRows = await db.select().from(cycleStates).where(eq(cycleStates.user, user)).limit(1);
  if (!legacyRows.length) return stored;

  // Migración desde SQLite: el llavero gana si ya tiene valor.
  const legacy = parseDate(legacyRows[0]?.lastPeriodStart);
  const value = stored ?? legacy;
  if (!stored && legacy) await saveLastPeriodStart(user, legacy);
  await db.delete(cycleStates).where(eq(cycleStates.user, user));
  return value;
}
