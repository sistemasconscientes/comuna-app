import { Platform } from 'react-native';
import type {
  HealthKitCycleSignals,
  HealthKitDataScreenRow,
  HealthKitDataScreenSnapshot,
  HealthKitLifecycleContext,
} from '../types';
import { reportErrorToSentry } from '../utils/observability';
import {
  addLocalCalendarDays,
  derivePeriodStartFromFlowSampleDates,
  inferBbtRiseAnchorFromSamples,
  startOfLocalCalendarDay,
} from '../utils/phaseCalculator';

type HealthKitAPI = typeof import('@kingstinct/react-native-healthkit');

/** Carga diferida: evita ejecutar Nitro en web/Expo Go hasta que haga falta en iOS. */
let hkModule: HealthKitAPI | null = null;
let hkLoadFailed = false;
let loadPromise: Promise<HealthKitAPI | null> | null = null;

const HK_MENSTRUAL_FLOW = 'HKCategoryTypeIdentifierMenstrualFlow' as const;
/**
 * iOS 18+ expone sangrado vaginal en HealthKit, pero kingstinct 13.x no mapea
 * `HKCategoryTypeIdentifierVaginalBleeding` en su enum nativo → falla `queryCategorySamples`.
 * Reintroducir cuando el SDK lo soporte (o vía API raw).
 */
const HK_INTERMENSTRUAL = 'HKCategoryTypeIdentifierIntermenstrualBleeding' as const;
const HK_OVULATION_TEST = 'HKCategoryTypeIdentifierOvulationTestResult' as const;
const HK_CERVICAL_MUCUS = 'HKCategoryTypeIdentifierCervicalMucusQuality' as const;
const HK_BBT = 'HKQuantityTypeIdentifierBasalBodyTemperature' as const;
const HK_PREGNANCY_TEST = 'HKCategoryTypeIdentifierPregnancyTestResult' as const;
const HK_LACTATION = 'HKCategoryTypeIdentifierLactation' as const;
const HK_CONTRACEPTIVE = 'HKCategoryTypeIdentifierContraceptive' as const;

const HK_IRREGULAR_CYCLE_IDS = [
  'HKCategoryTypeIdentifierIrregularMenstrualCycles',
  'HKCategoryTypeIdentifierInfrequentMenstrualCycles',
  'HKCategoryTypeIdentifierPersistentIntermenstrualBleeding',
  'HKCategoryTypeIdentifierProlongedMenstrualPeriods',
] as const;

/** @see CategoryValueMenstrualFlow en @kingstinct/react-native-healthkit */
const FLOW_LIGHT = 2;
const FLOW_UNSPECIFIED = 1;

/** @see CategoryValueOvulationTestResult */
const OVULATION_LH_SURGE = 2;
const OVULATION_ESTROGEN_SURGE = 4;

/** @see CategoryValueCervicalMucusQuality */
const MUCUS_WATERY = 4;
const MUCUS_EGG_WHITE = 5;

/** @see CategoryValuePregnancyTestResult */
const PREGNANCY_TEST_POSITIVE = 2;

export const EMPTY_HEALTH_KIT_CYCLE_SIGNALS: HealthKitCycleSignals = {
  lastPeriodStart: null,
  ovulationSignalDate: null,
  peakFertileMucusDate: null,
  bbtRiseAnchorDate: null,
  irregularCycleReported: false,
  lifecycleContext: 'none',
};

async function ensureHealthKit(): Promise<HealthKitAPI | null> {
  if (Platform.OS !== 'ios') return null;
  if (hkLoadFailed) return null;
  if (hkModule) return hkModule;
  if (!loadPromise) {
    loadPromise = import('@kingstinct/react-native-healthkit')
      .then((m) => {
        const mm: any = m as any;
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

/** Errores esperables: permiso pendiente/denegado por tipo, o bridge sin enum para un identificador. */
function isBenignHealthKitReadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/authorization not determined/i.test(msg)) return true;
  if (/authorization status is not determined/i.test(msg)) return true;
  if (/Code=5\b/i.test(msg) && /healthkit/i.test(msg)) return true;
  if (/invalid value/i.test(msg) && /CategoryTypeIdentifier/i.test(msg)) return true;
  return false;
}

function logHealthKitError(message: string, err: unknown): void {
  if (!__DEV__) return;
  if (isBenignHealthKitReadError(err)) return;
  console.warn(`[HealthKit] ${message}`, err);
}

/** Tipos de lectura a solicitar (solo los que el SO expone en este dispositivo). */
async function buildReadTypes(hk: HealthKitAPI): Promise<string[]> {
  const candidates: string[] = [
    HK_MENSTRUAL_FLOW,
    HK_INTERMENSTRUAL,
    HK_OVULATION_TEST,
    HK_CERVICAL_MUCUS,
    HK_BBT,
    HK_PREGNANCY_TEST,
    HK_LACTATION,
    HK_CONTRACEPTIVE,
    ...HK_IRREGULAR_CYCLE_IDS,
  ];

  try {
    const areObjectTypesAvailableAsync = (hk as any)?.areObjectTypesAvailableAsync;
    if (typeof areObjectTypesAvailableAsync !== 'function') {
      return [HK_MENSTRUAL_FLOW];
    }

    const map = await areObjectTypesAvailableAsync(candidates as any);
    return candidates.filter((id) => map[id] === true);
  } catch {
    return [HK_MENSTRUAL_FLOW];
  }
}

async function requestReadAuthorization(hk: HealthKitAPI): Promise<void> {
  const isHealthDataAvailableAsync = (hk as any)?.isHealthDataAvailableAsync;
  if (typeof isHealthDataAvailableAsync !== 'function') {
    return;
  }

  const ok = await isHealthDataAvailableAsync();
  if (!ok) {
    return;
  }

  const toRead = await buildReadTypes(hk);
  if (toRead.length === 0) {
    return;
  }

  const payload = { toShare: [] as any[], toRead: toRead as any };

  try {
    await hk.getRequestStatusForAuthorization(payload);
  } catch (e) {
    logHealthKitError('getRequestStatusForAuthorization falló', e);
  }

  try {
    await hk.requestAuthorization(payload);
  } catch (e) {
    logHealthKitError(
      'requestAuthorization falló. Si el mensaje menciona argumentos no válidos, puede haber un conflicto de tipos en este iOS; revisa también entitlements HealthKit y dev build (no Expo Go).',
      e,
    );
  }
}

let initPromise: Promise<void> | null = null;

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
      logHealthKitError('initHealthKit', e);
    });

  return initPromise;
}

async function queryCategorySamplesRaw(
  hk: HealthKitAPI,
  identifier: string,
  options: { limit: number; ascending?: boolean; filter?: any },
): Promise<any[]> {
  const queryCategorySamples = (hk as any)?.queryCategorySamples;
  if (typeof queryCategorySamples !== 'function') return [];
  try {
    const samples: any[] = await queryCategorySamples(identifier as any, options);
    return Array.isArray(samples) ? samples : [];
  } catch (e) {
    logHealthKitError(`queryCategorySamples(${identifier})`, e);
    return [];
  }
}

function inferLastPeriodStartFromSamples(
  menstrualSamples: any[],
  vaginalStarts: Date[],
  intermenstrualSamples: any[],
): Date | null {
  const cycleStartDates: Date[] = [];
  for (const s of menstrualSamples) {
    const marked =
      s?.metadataMenstrualCycleStart === true || s?.metadata?.HKMenstrualCycleStart === true;
    if (!marked || !s?.startDate) continue;
    const d = new Date(s.startDate);
    if (!Number.isNaN(d.getTime())) cycleStartDates.push(d);
  }
  if (cycleStartDates.length > 0) {
    cycleStartDates.sort((a, b) => b.getTime() - a.getTime());
    return startOfLocalCalendarDay(cycleStartDates[0]!);
  }

  const intermenstrualDayMs = new Set<number>();
  for (const s of intermenstrualSamples) {
    if (!s?.startDate) continue;
    const d = new Date(s.startDate);
    if (Number.isNaN(d.getTime())) continue;
    intermenstrualDayMs.add(startOfLocalCalendarDay(d).getTime());
  }

  const flowDates: Date[] = [];
  for (const s of menstrualSamples) {
    if (!s?.startDate) continue;
    const d = new Date(s.startDate);
    if (Number.isNaN(d.getTime())) continue;
    const dayMs = startOfLocalCalendarDay(d).getTime();
    const v = Number(s.value);
    const isLightOrUnspec = v === FLOW_LIGHT || v === FLOW_UNSPECIFIED;
    const hasIM = intermenstrualDayMs.has(dayMs);
    const markedStart =
      s?.metadataMenstrualCycleStart === true || s?.metadata?.HKMenstrualCycleStart === true;
    if (isLightOrUnspec && hasIM && !markedStart) continue;
    flowDates.push(d);
  }
  for (const d of vaginalStarts) flowDates.push(d);

  const inferred = derivePeriodStartFromFlowSampleDates(flowDates);
  if (inferred) return inferred;

  return null;
}

async function queryFlowSampleStarts(hk: HealthKitAPI, identifier: string): Promise<Date[]> {
  const samples = await queryCategorySamplesRaw(hk, identifier, {
    limit: 120,
    ascending: false,
  });
  return samples
    .map((s) => (s?.startDate ? new Date(s.startDate) : null))
    .filter((d): d is Date => d != null && !Number.isNaN(d.getTime()));
}

async function tryMostRecentCategoryStart(hk: HealthKitAPI, identifier: string): Promise<Date | null> {
  const getMostRecentCategorySample = (hk as any)?.getMostRecentCategorySample;
  if (typeof getMostRecentCategorySample !== 'function') {
    return null;
  }
  try {
    const sample: any = await getMostRecentCategorySample(identifier as any);
    const start = sample?.startDate ? new Date(sample.startDate) : null;
    if (start && !Number.isNaN(start.getTime())) return start;
  } catch (e) {
    logHealthKitError(`getMostRecentCategorySample(${identifier})`, e);
  }
  return null;
}

async function computeLastPeriodStart(hk: HealthKitAPI): Promise<Date | null> {
  const menstrualSamples = await queryCategorySamplesRaw(hk, HK_MENSTRUAL_FLOW, {
    limit: 120,
    ascending: false,
  });
  const intermenstrualSamples = await queryCategorySamplesRaw(hk, HK_INTERMENSTRUAL, {
    limit: 120,
    ascending: false,
  });
  const vaginalStarts: Date[] = [];

  const fromInference = inferLastPeriodStartFromSamples(
    menstrualSamples,
    vaginalStarts,
    intermenstrualSamples,
  );
  if (fromInference) return fromInference;

  const mergedStarts = [
    ...(await queryFlowSampleStarts(hk, HK_MENSTRUAL_FLOW)),
    ...vaginalStarts,
  ];
  const inferred = derivePeriodStartFromFlowSampleDates(mergedStarts);
  if (inferred) return inferred;

  const menstrual = await tryMostRecentCategoryStart(hk, HK_MENSTRUAL_FLOW);
  if (menstrual) return startOfLocalCalendarDay(menstrual);

  return null;
}

function pickLatestDate(dates: (Date | null)[]): Date | null {
  const valid = dates.filter((d): d is Date => d != null && !Number.isNaN(d.getTime()));
  if (valid.length === 0) return null;
  valid.sort((a, b) => b.getTime() - a.getTime());
  return valid[0]!;
}

async function fetchOvulationSignalDate(hk: HealthKitAPI, since: Date): Promise<Date | null> {
  const samples = await queryCategorySamplesRaw(hk, HK_OVULATION_TEST, {
    limit: 40,
    ascending: false,
    filter: { date: { startDate: since } },
  });
  const surgeDates: Date[] = [];
  for (const s of samples) {
    const v = Number(s.value);
    if (v !== OVULATION_LH_SURGE && v !== OVULATION_ESTROGEN_SURGE) continue;
    if (!s?.startDate) continue;
    const d = new Date(s.startDate);
    if (!Number.isNaN(d.getTime())) surgeDates.push(d);
  }
  return pickLatestDate(surgeDates);
}

async function fetchPeakFertileMucusDate(hk: HealthKitAPI, since: Date): Promise<Date | null> {
  const samples = await queryCategorySamplesRaw(hk, HK_CERVICAL_MUCUS, {
    limit: 40,
    ascending: false,
    filter: { date: { startDate: since } },
  });
  const dates: Date[] = [];
  for (const s of samples) {
    const v = Number(s.value);
    if (v !== MUCUS_WATERY && v !== MUCUS_EGG_WHITE) continue;
    if (!s?.startDate) continue;
    const d = new Date(s.startDate);
    if (!Number.isNaN(d.getTime())) dates.push(d);
  }
  return pickLatestDate(dates);
}

async function fetchBbtRiseAnchor(hk: HealthKitAPI, since: Date): Promise<Date | null> {
  const queryQuantitySamples = (hk as any)?.queryQuantitySamples;
  const getPreferredUnit = (hk as any)?.getPreferredUnit;
  if (typeof queryQuantitySamples !== 'function' || typeof getPreferredUnit !== 'function') {
    return null;
  }
  let unitStr = 'degC';
  try {
    unitStr = await getPreferredUnit(HK_BBT);
  } catch (e) {
    logHealthKitError('getPreferredUnit(BBT)', e);
  }
  const unitIsF = /f|°f/i.test(String(unitStr));

  try {
    const raw: any[] = await queryQuantitySamples(HK_BBT, {
      limit: 45,
      ascending: false,
      unit: unitStr,
      filter: { date: { startDate: since } },
    });
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const mapped = raw
      .map((s) => {
        const t = s?.startDate ? new Date(s.startDate) : null;
        const q = Number(s?.quantity);
        if (!t || Number.isNaN(t.getTime()) || Number.isNaN(q)) return null;
        return { date: t, value: q };
      })
      .filter((x): x is { date: Date; value: number } => x != null);
    return inferBbtRiseAnchorFromSamples(mapped, unitIsF);
  } catch (e) {
    logHealthKitError('queryQuantitySamples(BBT)', e);
    return null;
  }
}

async function fetchIrregularCycleReported(hk: HealthKitAPI): Promise<boolean> {
  const since = addLocalCalendarDays(new Date(), -365);
  for (const id of HK_IRREGULAR_CYCLE_IDS) {
    const samples = await queryCategorySamplesRaw(hk, id, {
      limit: 3,
      ascending: false,
    });
    for (const s of samples) {
      if (!s?.startDate) continue;
      const d = new Date(s.startDate);
      if (Number.isNaN(d.getTime())) continue;
      if (d >= since) return true;
    }
  }
  return false;
}

async function fetchLifecycleContext(hk: HealthKitAPI): Promise<HealthKitLifecycleContext> {
  const sinceTest = addLocalCalendarDays(new Date(), -270);
  const pregTests = await queryCategorySamplesRaw(hk, HK_PREGNANCY_TEST, {
    limit: 25,
    ascending: false,
    filter: { date: { startDate: sinceTest } },
  });
  for (const s of pregTests) {
    if (Number(s.value) === PREGNANCY_TEST_POSITIVE) return 'pregnancy';
  }

  const sinceLac = addLocalCalendarDays(new Date(), -120);
  const lacSamples = await queryCategorySamplesRaw(hk, HK_LACTATION, {
    limit: 15,
    ascending: false,
    filter: { date: { startDate: sinceLac } },
  });
  if (lacSamples.length > 0) return 'lactation';

  const sinceCon = addLocalCalendarDays(new Date(), -90);
  const conSamples = await queryCategorySamplesRaw(hk, HK_CONTRACEPTIVE, {
    limit: 5,
    ascending: false,
    filter: { date: { startDate: sinceCon } },
  });
  if (conSamples.length > 0) return 'contraceptive';

  return 'none';
}

async function fetchHealthKitCycleSignalsForHk(hk: HealthKitAPI): Promise<HealthKitCycleSignals> {
  const lastPeriodStart = await computeLastPeriodStart(hk);
  const irregularCycleReported = await fetchIrregularCycleReported(hk);
  const lifecycleContext = await fetchLifecycleContext(hk);

  let ovulationSignalDate: Date | null = null;
  let peakFertileMucusDate: Date | null = null;
  let bbtRiseAnchorDate: Date | null = null;

  if (lastPeriodStart) {
    const since = startOfLocalCalendarDay(lastPeriodStart);
    const [ov, muc, bbt] = await Promise.all([
      fetchOvulationSignalDate(hk, since),
      fetchPeakFertileMucusDate(hk, since),
      fetchBbtRiseAnchor(hk, since),
    ]);
    ovulationSignalDate = ov;
    peakFertileMucusDate = muc;
    bbtRiseAnchorDate = bbt;
  }

  return {
    lastPeriodStart,
    ovulationSignalDate,
    peakFertileMucusDate,
    bbtRiseAnchorDate,
    irregularCycleReported,
    lifecycleContext,
  };
}

function formatHealthKitLocalDate(d: Date): string {
  try {
    return d.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function healthKitAuthLabel(status: number): string {
  if (status === 0) return 'Permiso pendiente (no determinado)';
  if (status === 1) return 'Acceso denegado (Ajustes → Salud → La Comuna)';
  return 'Autorizado para leer';
}

async function readAuthorizationStatusSafe(
  hk: HealthKitAPI,
  identifier: string,
  rowId: string,
): Promise<{ ok: true; status: number } | { ok: false }> {
  try {
    const fn = (hk as any).authorizationStatusFor;
    if (typeof fn !== 'function') return { ok: true, status: 0 };
    const s = fn(identifier as any);
    const status = typeof s === 'number' ? s : Number(s);
    return { ok: true, status: Number.isFinite(status) ? status : 0 };
  } catch (e) {
    reportErrorToSentry(e, {
      domain: 'healthkit_data_screen',
      operation: 'authorizationStatusFor',
      row_id: rowId,
      healthkit_identifier: identifier,
    });
    return { ok: false };
  }
}

/** false = fallo no benigno al leer (ya reportado a Sentry). */
async function probeCategorySamplesReadable(
  hk: HealthKitAPI,
  identifier: string,
  rowId: string,
): Promise<boolean> {
  const q = (hk as any)?.queryCategorySamples;
  if (typeof q !== 'function') return true;
  try {
    await q(identifier as any, { limit: 1, ascending: false });
    return true;
  } catch (e) {
    if (isBenignHealthKitReadError(e)) return true;
    reportErrorToSentry(e, {
      domain: 'healthkit_data_screen',
      operation: 'queryCategorySamples',
      row_id: rowId,
      healthkit_identifier: identifier,
    });
    return false;
  }
}

async function probeBbtReadable(hk: HealthKitAPI, since: Date, rowId: string): Promise<boolean> {
  const queryQuantitySamples = (hk as any)?.queryQuantitySamples;
  const getPreferredUnit = (hk as any)?.getPreferredUnit;
  if (typeof queryQuantitySamples !== 'function') return true;
  let unitStr = 'degC';
  if (typeof getPreferredUnit === 'function') {
    try {
      unitStr = await getPreferredUnit(HK_BBT);
    } catch (e) {
      if (!isBenignHealthKitReadError(e)) {
        reportErrorToSentry(e, {
          domain: 'healthkit_data_screen',
          operation: 'getPreferredUnit',
          row_id: rowId,
        });
        return false;
      }
    }
  }
  try {
    await queryQuantitySamples(HK_BBT, {
      limit: 1,
      ascending: false,
      unit: unitStr,
      filter: { date: { startDate: since } },
    });
    return true;
  } catch (e) {
    if (isBenignHealthKitReadError(e)) return true;
    reportErrorToSentry(e, {
      domain: 'healthkit_data_screen',
      operation: 'queryQuantitySamples',
      row_id: rowId,
    });
    return false;
  }
}

function hkDataRow(
  id: string,
  label: string,
  kind: HealthKitDataScreenRow['kind'],
  text: string,
  hint?: string,
): HealthKitDataScreenRow {
  return hint !== undefined ? { id, label, kind, text, hint } : { id, label, kind, text };
}

function lifecycleContextLabel(ctx: HealthKitLifecycleContext): { text: string; hint?: string } {
  switch (ctx) {
    case 'pregnancy':
      return {
        text: 'Test de embarazo positivo reciente en Salud',
        hint: 'Ventana ~9 meses hacia atrás',
      };
    case 'lactation':
      return { text: 'Lactancia registrada reciente', hint: 'Ventana ~120 días' };
    case 'contraceptive':
      return { text: 'Uso de anticonceptivo registrado', hint: 'Ventana ~90 días' };
    default:
      return {
        text: 'Sin señales recientes de embarazo, lactancia ni anticonceptivo',
        hint: 'Según categorías que la app consulta en Salud',
      };
  }
}

/**
 * Snapshot para la pestaña Salud: valores legibles, “sin datos” vs permisos vs error de lectura.
 * Errores no benignos → Sentry (`domain: healthkit_data_screen`).
 */
export async function getHealthKitDataScreenSnapshot(): Promise<HealthKitDataScreenSnapshot> {
  const refreshedAt = new Date().toISOString();

  if (Platform.OS !== 'ios') {
    return {
      refreshedAt,
      rows: [
        hkDataRow(
          'platform',
          'Plataforma',
          'unavailable',
          'HealthKit solo está disponible en iOS.',
          'En esta plataforma no hay lectura de Apple Salud.',
        ),
      ],
    };
  }

  await initHealthKit();
  const diagnostics = await getHealthKitDiagnostics();
  const hk = await ensureHealthKit();

  const rows: HealthKitDataScreenRow[] = [
    hkDataRow('platform', 'Plataforma', 'info', 'iOS', undefined),
    hkDataRow(
      'native_module',
      'Módulo nativo HealthKit',
      diagnostics.nativeModuleLoaded ? 'value' : 'error',
      diagnostics.nativeModuleLoaded ? 'Cargado' : 'No disponible',
      diagnostics.nativeModuleLoaded
        ? undefined
        : 'Usa un dev build con el módulo (no Expo Go).',
    ),
    hkDataRow(
      'health_store',
      'Repositorio de Salud',
      diagnostics.healthStoreAvailable ? 'value' : diagnostics.nativeModuleLoaded ? 'no_data' : 'unavailable',
      diagnostics.healthStoreAvailable
        ? 'Disponible en el dispositivo'
        : diagnostics.nativeModuleLoaded
          ? 'No disponible (simulador sin Salud, restricciones, etc.)'
          : '—',
      undefined,
    ),
  ];

  if (!hk) {
    rows.push(
      hkDataRow(
        'blocked',
        'Lecturas',
        'unavailable',
        'No se puede consultar Salud sin el módulo nativo.',
        undefined,
      ),
    );
    return { rows, refreshedAt };
  }

  let signals: HealthKitCycleSignals = { ...EMPTY_HEALTH_KIT_CYCLE_SIGNALS };
  let bundleNonBenignError = false;
  try {
    signals = await fetchHealthKitCycleSignalsForHk(hk);
  } catch (e) {
    signals = { ...EMPTY_HEALTH_KIT_CYCLE_SIGNALS };
    if (!isBenignHealthKitReadError(e)) {
      bundleNonBenignError = true;
      reportErrorToSentry(e, {
        domain: 'healthkit_data_screen',
        operation: 'fetchHealthKitCycleSignalsForHk',
      });
    }
  }

  rows.push(
    hkDataRow(
      'bundle_read',
      'Lectura consolidada (ciclo)',
      bundleNonBenignError ? 'error' : 'value',
      bundleNonBenignError
        ? 'Error al obtener el bloque de datos de ciclo'
        : 'Completada sin fallos graves',
      bundleNonBenignError
        ? 'Los permisos pendientes no cuentan como error. Si ves esto, el fallo se envió a Sentry.'
        : 'Ovulación, moco y BBT dependen de tener inicio de período en Salud.',
    ),
  );

  const flowAuth = await readAuthorizationStatusSafe(hk, HK_MENSTRUAL_FLOW, 'auth_flow');
  rows.push(
    !flowAuth.ok
      ? hkDataRow(
          'auth_flow',
          'Permiso: flujo menstrual',
          'error',
          'No se pudo leer el estado de permiso',
          'Fallo al consultar autorización (ver Sentry).',
        )
      : hkDataRow(
          'auth_flow',
          'Permiso: flujo menstrual',
          flowAuth.status === 2 ? 'value' : 'permission',
          healthKitAuthLabel(flowAuth.status),
          undefined,
        ),
  );

  const canReadFlow = flowAuth.ok && flowAuth.status === 2;

  if (!canReadFlow) {
    rows.push(
      hkDataRow(
        'last_period',
        'Inicio del último período (derivado)',
        'permission',
        'Sin acceso al flujo menstrual',
        'Concede lectura en Salud para ver fechas.',
      ),
    );
  } else {
    const flowProbe = await probeCategorySamplesReadable(hk, HK_MENSTRUAL_FLOW, 'last_period');
    if (!flowProbe) {
      rows.push(
        hkDataRow(
          'last_period',
          'Inicio del último período (derivado)',
          'error',
          'Error al leer muestras de flujo',
          'El fallo no benigno se envió a Sentry.',
        ),
      );
    } else if (signals.lastPeriodStart) {
      rows.push(
        hkDataRow(
          'last_period',
          'Inicio del último período (derivado)',
          'value',
          formatHealthKitLocalDate(signals.lastPeriodStart),
          'Basado en flujo menstrual e intermenstrual en Salud.',
        ),
      );
    } else {
      rows.push(
        hkDataRow(
          'last_period',
          'Inicio del último período (derivado)',
          'no_data',
          'Sin datos en Salud',
          'No hay muestras suficientes para inferir el inicio del ciclo.',
        ),
      );
    }
  }

  const sinceForBbt =
    signals.lastPeriodStart != null
      ? startOfLocalCalendarDay(signals.lastPeriodStart)
      : addLocalCalendarDays(new Date(), -120);

  const ovAuth = await readAuthorizationStatusSafe(hk, HK_OVULATION_TEST, 'auth_ovulation');
  rows.push(
    !ovAuth.ok
      ? hkDataRow('auth_ovulation', 'Permiso: test de ovulación', 'error', 'No se pudo leer el permiso', undefined)
      : hkDataRow(
          'auth_ovulation',
          'Permiso: test de ovulación',
          ovAuth.status === 2 ? 'value' : 'permission',
          healthKitAuthLabel(ovAuth.status),
          undefined,
        ),
  );

  if (!ovAuth.ok || ovAuth.status !== 2) {
    rows.push(
      hkDataRow(
        'ovulation',
        'Señal de ovulación (LH / estrógeno)',
        'permission',
        'Sin permiso para test de ovulación',
        undefined,
      ),
    );
  } else if (!signals.lastPeriodStart) {
    rows.push(
      hkDataRow(
        'ovulation',
        'Señal de ovulación (LH / estrógeno)',
        'no_data',
        'Sin ventana de ciclo',
        'La app solo busca tras un inicio de período en Salud.',
      ),
    );
  } else {
    const okProbe = await probeCategorySamplesReadable(hk, HK_OVULATION_TEST, 'ovulation');
    if (!okProbe) {
      rows.push(
        hkDataRow(
          'ovulation',
          'Señal de ovulación (LH / estrógeno)',
          'error',
          'Error al leer test de ovulación',
          'Ver Sentry.',
        ),
      );
    } else if (signals.ovulationSignalDate) {
      rows.push(
        hkDataRow(
          'ovulation',
          'Señal de ovulación (LH / estrógeno)',
          'value',
          formatHealthKitLocalDate(signals.ovulationSignalDate),
          'Pico LH o surge de estrógeno en la ventana del ciclo actual.',
        ),
      );
    } else {
      rows.push(
        hkDataRow(
          'ovulation',
          'Señal de ovulación (LH / estrógeno)',
          'no_data',
          'Sin datos en Salud',
          'No hay resultado positivo reciente en la ventana del ciclo.',
        ),
      );
    }
  }

  const mucAuth = await readAuthorizationStatusSafe(hk, HK_CERVICAL_MUCUS, 'auth_mucus');
  rows.push(
    !mucAuth.ok
      ? hkDataRow('auth_mucus', 'Permiso: moco cervical', 'error', 'No se pudo leer el permiso', undefined)
      : hkDataRow(
          'auth_mucus',
          'Permiso: moco cervical',
          mucAuth.status === 2 ? 'value' : 'permission',
          healthKitAuthLabel(mucAuth.status),
          undefined,
        ),
  );

  if (!mucAuth.ok || mucAuth.status !== 2) {
    rows.push(
      hkDataRow(
        'mucus',
        'Moco fértil (aguado / clara de huevo)',
        'permission',
        'Sin permiso para moco cervical',
        undefined,
      ),
    );
  } else if (!signals.lastPeriodStart) {
    rows.push(
      hkDataRow(
        'mucus',
        'Moco fértil (aguado / clara de huevo)',
        'no_data',
        'Sin ventana de ciclo',
        'La app solo busca tras un inicio de período en Salud.',
      ),
    );
  } else {
    const okProbe = await probeCategorySamplesReadable(hk, HK_CERVICAL_MUCUS, 'mucus');
    if (!okProbe) {
      rows.push(
        hkDataRow(
          'mucus',
          'Moco fértil (aguado / clara de huevo)',
          'error',
          'Error al leer moco cervical',
          'Ver Sentry.',
        ),
      );
    } else if (signals.peakFertileMucusDate) {
      rows.push(
        hkDataRow(
          'mucus',
          'Moco fértil (aguado / clara de huevo)',
          'value',
          formatHealthKitLocalDate(signals.peakFertileMucusDate),
          undefined,
        ),
      );
    } else {
      rows.push(
        hkDataRow(
          'mucus',
          'Moco fértil (aguado / clara de huevo)',
          'no_data',
          'Sin datos en Salud',
          'No hay moco aguado o clara de huevo en la ventana del ciclo.',
        ),
      );
    }
  }

  const bbtAuth = await readAuthorizationStatusSafe(hk, HK_BBT, 'auth_bbt');
  rows.push(
    !bbtAuth.ok
      ? hkDataRow('auth_bbt', 'Permiso: temperatura basal', 'error', 'No se pudo leer el permiso', undefined)
      : hkDataRow(
          'auth_bbt',
          'Permiso: temperatura basal',
          bbtAuth.status === 2 ? 'value' : 'permission',
          healthKitAuthLabel(bbtAuth.status),
          undefined,
        ),
  );

  if (!bbtAuth.ok || bbtAuth.status !== 2) {
    rows.push(
      hkDataRow(
        'bbt',
        'Subida de temperatura basal (ancla)',
        'permission',
        'Sin permiso para temperatura basal',
        undefined,
      ),
    );
  } else if (!signals.lastPeriodStart) {
    rows.push(
      hkDataRow(
        'bbt',
        'Subida de temperatura basal (ancla)',
        'no_data',
        'Sin ventana de ciclo',
        'La app solo calcula BBT tras inicio de período en Salud.',
      ),
    );
  } else {
    const bbtOk = await probeBbtReadable(hk, sinceForBbt, 'bbt');
    if (!bbtOk) {
      rows.push(
        hkDataRow(
          'bbt',
          'Subida de temperatura basal (ancla)',
          'error',
          'Error al leer temperatura basal',
          'Ver Sentry.',
        ),
      );
    } else if (signals.bbtRiseAnchorDate) {
      rows.push(
        hkDataRow(
          'bbt',
          'Subida de temperatura basal (ancla)',
          'value',
          formatHealthKitLocalDate(signals.bbtRiseAnchorDate),
          'Heurística sobre muestras en la ventana del ciclo.',
        ),
      );
    } else {
      rows.push(
        hkDataRow(
          'bbt',
          'Subida de temperatura basal (ancla)',
          'no_data',
          'Sin datos en Salud',
          'No hay muestras suficientes o no se detecta subida.',
        ),
      );
    }
  }

  if (!canReadFlow) {
    rows.push(
      hkDataRow(
        'irregular',
        'Ciclo irregular (categorías Salud)',
        'permission',
        'Requiere permiso de flujo menstrual',
        undefined,
      ),
    );
  } else {
    const irProbe = await probeCategorySamplesReadable(
      hk,
      HK_IRREGULAR_CYCLE_IDS[0]!,
      'irregular_probe',
    );
    if (!irProbe) {
      rows.push(
        hkDataRow(
          'irregular',
          'Ciclo irregular (categorías Salud)',
          'error',
          'Error al leer categorías de irregularidad',
          'Ver Sentry.',
        ),
      );
    } else {
      rows.push(
        hkDataRow(
          'irregular',
          'Ciclo irregular (categorías Salud)',
          signals.irregularCycleReported ? 'value' : 'no_data',
          signals.irregularCycleReported ? 'Sí (muestra reciente)' : 'No',
          'Tipos iOS 16+ que la app consulta.',
        ),
      );
    }
  }

  const lc = lifecycleContextLabel(signals.lifecycleContext);
  const lifecycleKind: HealthKitDataScreenRow['kind'] = bundleNonBenignError
    ? 'error'
    : signals.lifecycleContext === 'none'
      ? 'info'
      : 'value';
  rows.push(
    hkDataRow(
      'lifecycle',
      'Contexto embarazo / lactancia / anticonceptivo',
      lifecycleKind,
      bundleNonBenignError ? 'No disponible por error en lectura consolidada' : lc.text,
      bundleNonBenignError ? undefined : lc.hint,
    ),
  );

  return { rows, refreshedAt };
}

/**
 * Lectura consolidada de señales de ciclo/fertilidad en Salud (iOS).
 * No sustituye el perfil de la app: los datos son del dispositivo.
 */
export async function fetchHealthKitCycleSignals(): Promise<HealthKitCycleSignals> {
  if (Platform.OS !== 'ios') return { ...EMPTY_HEALTH_KIT_CYCLE_SIGNALS };

  await initHealthKit();
  const hk = await ensureHealthKit();
  if (!hk) return { ...EMPTY_HEALTH_KIT_CYCLE_SIGNALS };

  try {
    return await fetchHealthKitCycleSignalsForHk(hk);
  } catch (e) {
    logHealthKitError('fetchHealthKitCycleSignals', e);
    return { ...EMPTY_HEALTH_KIT_CYCLE_SIGNALS };
  }
}

export async function getLastMenstruation(): Promise<Date | null> {
  const s = await fetchHealthKitCycleSignals();
  return s.lastPeriodStart;
}
