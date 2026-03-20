import { Platform } from 'react-native';

/** HKAuthorizationRequestStatus (misma numeración que Kingstinct/Apple). */
const AuthRequestShouldRequest = 1;
const AuthRequestUnnecessary = 2;

type HealthKitAPI = typeof import('@kingstinct/react-native-healthkit');

/** Carga diferida: evita ejecutar Nitro en web/Expo Go hasta que haga falta en iOS. */
let hkModule: HealthKitAPI | null = null;
let hkLoadFailed = false;
let loadPromise: Promise<HealthKitAPI | null> | null = null;

const HK_MENSTRUAL_FLOW = 'HKCategoryTypeIdentifierMenstrualFlow' as const;
/** iOS 18+: registro de sangrado en Ciclo menstrual (sustituye en parte el flujo clásico). */
const HK_VAGINAL_BLEEDING = 'HKCategoryTypeIdentifierVaginalBleeding' as const;

function iosMajor(): number {
  if (Platform.OS !== 'ios') return 0;
  const v = Platform.Version;
  return typeof v === 'string' ? parseInt(v.split('.')[0] ?? '0', 10) : Number(v);
}

async function ensureHealthKit(): Promise<HealthKitAPI | null> {
  if (Platform.OS !== 'ios') return null;
  if (hkLoadFailed) return null;
  if (hkModule) return hkModule;
  if (!loadPromise) {
    loadPromise = import('@kingstinct/react-native-healthkit')
      .then((m) => {
        const mm: any = m as any;
        // El `import()` dinámico en RN/Metro a veces devuelve:
        // - todo el namespace
        // - solo `default`
        // - o un default anidado (`default.default`)
        // Elegimos el candidato que tenga (al menos) las funciones esperadas.
        const candidates: any[] = [
          mm,
          mm?.default,
          mm?.default?.default,
          mm?.default?.default?.default,
        ];

        const pick =
          candidates.find(
            (c) =>
              typeof c?.getMostRecentCategorySample === 'function' ||
              typeof c?.isHealthDataAvailableAsync === 'function',
          ) ?? mm?.default ?? mm;

        hkModule = pick;
        return hkModule;
      })
      .catch(() => {
        hkLoadFailed = true;
        return null;
      });
  }
  return loadPromise;
}

function logHealthKit(message: string, err?: unknown) {
  if (__DEV__) {
    if (err !== undefined) console.warn(`[HealthKit] ${message}`, err);
    else console.warn(`[HealthKit] ${message}`);
  }
}

/** Tipos de lectura a solicitar (solo los que el SO expone en este dispositivo). */
async function buildReadTypes(hk: HealthKitAPI): Promise<string[]> {
  const major = iosMajor();
  const candidates: string[] = [HK_MENSTRUAL_FLOW];
  if (major >= 18) {
    candidates.push(HK_VAGINAL_BLEEDING);
  }

  try {
    const areObjectTypesAvailableAsync = (hk as any)?.areObjectTypesAvailableAsync;
    if (typeof areObjectTypesAvailableAsync !== 'function') return [HK_MENSTRUAL_FLOW];

    const map = await areObjectTypesAvailableAsync(candidates as any);
    return candidates.filter((id) => map[id] === true);
  } catch {
    return [HK_MENSTRUAL_FLOW];
  }
}

/**
 * Misma forma que useHealthkitAuthorization: toShare + toRead.
 * @see https://github.com/kingstinct/react-native-healthkit — Core.requestAuthorization
 */
async function requestReadAuthorization(hk: HealthKitAPI): Promise<void> {
  const isHealthDataAvailableAsync = (hk as any)?.isHealthDataAvailableAsync;
  if (typeof isHealthDataAvailableAsync !== 'function') {
    logHealthKit(
      'Kingstinct HealthKit no expone isHealthDataAvailableAsync en este runtime; cayendo a no-op.',
    );
    return;
  }

  const ok = await isHealthDataAvailableAsync();
  if (!ok) {
    logHealthKit('HealthKit no está disponible en este dispositivo (p. ej. simulador sin datos).');
    return;
  }

  const toRead = await buildReadTypes(hk);
  if (toRead.length === 0) {
    logHealthKit('Ningún tipo de categoría menstrual está disponible en este iOS; no se puede pedir acceso.');
    return;
  }

  const payload = { toShare: [] as any[], toRead: toRead as any };

  try {
    const status = await hk.getRequestStatusForAuthorization(payload);
    if (__DEV__) {
      const label =
        status === AuthRequestShouldRequest
          ? 'shouldRequest'
          : status === AuthRequestUnnecessary
            ? 'unnecessary'
            : 'unknown';
      logHealthKit(`getRequestStatusForAuthorization: ${label} (tipos: ${toRead.join(', ')})`);
    }
    if (status === AuthRequestUnnecessary) {
      logHealthKit(
        'iOS no mostrará de nuevo el sheet. Revisa Ajustes > Salud > Acceso a datos y apps > La Comuna.'
      );
    }
  } catch (e) {
    logHealthKit('getRequestStatusForAuthorization falló', e);
  }

  try {
    await hk.requestAuthorization(payload);
  } catch (e) {
    logHealthKit(
      'requestAuthorization falló. Si el mensaje menciona argumentos no válidos, puede haber un conflicto de tipos en este iOS; revisa también entitlements HealthKit y dev build (no Expo Go).',
      e
    );
  }
}

let initPromise: Promise<void> | null = null;

/**
 * Solo para reintentar `requestAuthorization` tras cambiar permisos en Ajustes (p. ej. botón en Perfil).
 * No usar en caliente en bucles.
 */
export function resetHealthKitInitForQA(): void {
  initPromise = null;
}

export async function getHealthKitDiagnostics(): Promise<{
  nativeModuleLoaded: boolean;
  healthStoreAvailable: boolean;
}> {
  if (Platform.OS !== 'ios') {
    return { nativeModuleLoaded: false, healthStoreAvailable: false };
  }
  const hk = await ensureHealthKit();
  if (!hk) {
    return { nativeModuleLoaded: false, healthStoreAvailable: false };
  }
  try {
    const isHealthDataAvailableAsync = (hk as any)?.isHealthDataAvailableAsync;
    if (typeof isHealthDataAvailableAsync !== 'function') {
      return { nativeModuleLoaded: true, healthStoreAvailable: false };
    }

    const healthStoreAvailable = await isHealthDataAvailableAsync();
    return { nativeModuleLoaded: true, healthStoreAvailable };
  } catch {
    return { nativeModuleLoaded: true, healthStoreAvailable: false };
  }
}

export function initHealthKit(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = ensureHealthKit()
    .then(async (hk) => {
      if (!hk) return;
      await requestReadAuthorization(hk);
    })
    .catch((e) => {
      logHealthKit('initHealthKit', e);
    });

  return initPromise;
}

export async function getLastMenstruation(): Promise<Date | null> {
  if (Platform.OS !== 'ios') return null;
  await initHealthKit();

  const hk = await ensureHealthKit();
  if (!hk) return null;

  const trySample = async (identifier: string): Promise<Date | null> => {
    const getMostRecentCategorySample = (hk as any)?.getMostRecentCategorySample;
    if (typeof getMostRecentCategorySample !== 'function') {
      if (__DEV__) {
        logHealthKit(
          'Kingstinct HealthKit no expone getMostRecentCategorySample en este runtime; cayendo a fallback.',
        );
      }
      return null;
    }

    try {
      const sample: any = await getMostRecentCategorySample(identifier as any);
      const start = sample?.startDate ? new Date(sample.startDate) : null;
      if (start && !Number.isNaN(start.getTime())) return start;
    } catch (e) {
      if (__DEV__) logHealthKit(`getMostRecentCategorySample(${identifier})`, e);
    }
    return null;
  };

  const menstrual = await trySample(HK_MENSTRUAL_FLOW);
  if (menstrual) return menstrual;

  if (iosMajor() >= 18) {
    const vaginal = await trySample(HK_VAGINAL_BLEEDING);
    if (vaginal) return vaginal;
  }

  return null;
}
