import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProfileId } from '../config/profiles';
import { parseNutrients } from '../utils/nutrients';
import { reportErrorToSentry } from '../utils/observability';
import { deleteHealthSamples, saveNutrientSamples, type WrittenHealthSample } from './healthkit';
import { updateSupplementNutrientsInNotion } from './notion';

/**
 * Nutrientes por toma → Apple Salud (opt-in por perfil: Salud es de la dueña
 * del teléfono; un roomie que use su perfil aquí no debe escribir en él).
 *
 * - Texto de nutrientes: Notion (`Nutrientes`) si la DB tiene la propiedad;
 *   si no, respaldo local por suplemento.
 * - Al marcar una toma se guarda una muestra por nutriente; al desmarcar se
 *   borran exactamente esas muestras (uuids guardados por toma).
 */

const SYNC_KEY = 'nutrients_hk_sync_v1';
const LOCAL_TEXT_KEY = 'supplement_nutrients_local_v1';
const WRITTEN_KEY = 'nutrients_hk_written_v1';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ─── Preferencia por perfil ───

export async function isNutrientsHealthSyncEnabled(profile: ProfileId): Promise<boolean> {
  const map = await readJson<Record<string, boolean>>(SYNC_KEY, {});
  return map[profile] === true;
}

export async function setNutrientsHealthSyncEnabled(
  profile: ProfileId,
  enabled: boolean,
): Promise<void> {
  const map = await readJson<Record<string, boolean>>(SYNC_KEY, {});
  await writeJson(SYNC_KEY, { ...map, [profile]: enabled });
}

// ─── Texto de nutrientes por suplemento ───

/** Texto efectivo: Notion si la DB tiene la propiedad (aunque esté vacía); si no, local. */
export async function getNutrientsText(
  notionId: string,
  notionText: string | undefined,
): Promise<string> {
  if (notionText !== undefined) return notionText;
  const local = await readJson<Record<string, string>>(LOCAL_TEXT_KEY, {});
  return local[notionId] ?? '';
}

/** Guarda en Notion; si la DB no tiene la propiedad, local. Devuelve dónde quedó. */
export async function saveNutrientsText(
  notionId: string,
  text: string,
): Promise<'notion' | 'local'> {
  const inNotion = await updateSupplementNutrientsInNotion(notionId, text);
  if (inNotion) return 'notion';
  const local = await readJson<Record<string, string>>(LOCAL_TEXT_KEY, {});
  await writeJson(LOCAL_TEXT_KEY, { ...local, [notionId]: text });
  return 'local';
}

// ─── Muestras por toma ───

function logKey(profile: ProfileId, date: string, notionId: string): string {
  return `${profile}|${date}|${notionId}`;
}

/** Hora de la muestra: ahora si la toma es de hoy; si es de otro día, mediodía de ese día. */
function sampleDate(date: string): Date {
  const now = new Date();
  const [y, m, d] = date.split('-').map(Number);
  const sameDay = now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d;
  return sameDay ? now : new Date(y, m - 1, d, 12, 0, 0);
}

type SyncParams = {
  profile: ProfileId;
  date: string;
  notionId: string;
  notionNutrientsText: string | undefined;
  taken: boolean;
};

/** Cola: toques rápidos (marcar/desmarcar) no se pisan al leer/escribir los uuids. */
let syncQueue: Promise<void> = Promise.resolve();

/**
 * Sincroniza una toma con Salud: marcada → escribe nutrientes (si no estaban);
 * desmarcada → borra las muestras de esa toma. No lanza (fallos a Sentry).
 */
export function syncNutrientsForLog(params: SyncParams): Promise<void> {
  syncQueue = syncQueue.then(() => runSync(params));
  return syncQueue;
}

async function runSync(params: SyncParams): Promise<void> {
  const { profile, date, notionId, taken } = params;
  try {
    if (!(await isNutrientsHealthSyncEnabled(profile))) return;
    const key = logKey(profile, date, notionId);
    const written = await readJson<Record<string, WrittenHealthSample[]>>(WRITTEN_KEY, {});

    if (!taken) {
      const prev = written[key];
      if (!prev?.length) return;
      await deleteHealthSamples(prev);
      const { [key]: _removed, ...rest } = written;
      await writeJson(WRITTEN_KEY, rest);
      return;
    }

    if (written[key]?.length) return; // ya escrito (evita duplicar al re-marcar)
    const text = await getNutrientsText(notionId, params.notionNutrientsText);
    const nutrients = parseNutrients(text);
    if (!nutrients.length) return;
    const saved = await saveNutrientSamples(nutrients, sampleDate(date), {
      ComunaLogKey: key,
    });
    if (saved.length) await writeJson(WRITTEN_KEY, { ...written, [key]: saved });
  } catch (e) {
    reportErrorToSentry(e, { domain: 'nutrients_healthkit' });
  }
}
