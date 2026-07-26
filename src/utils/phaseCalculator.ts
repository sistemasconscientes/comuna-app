import type { CyclePhase } from '../types';

/** Longitud del ciclo en días (modelo por defecto; ver `getPhaseFromCycleDay` sin config). */
export const DEFAULT_CYCLE_LENGTH_DAYS = 28;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Medianoche local del día calendario del dispositivo (misma convención que `Date` en RN). */
export function startOfLocalCalendarDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Días calendario locales entre dos instantes (no bloques fijos de 24 h UTC). */
export function localCalendarDaysBetween(from: Date, to: Date): number {
  const a = startOfLocalCalendarDay(from).getTime();
  const b = startOfLocalCalendarDay(to).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/**
 * Hueco máximo en días civiles locales entre dos días con flujo para seguir
 * considerándolos el mismo episodio (p. ej. olvidó registrar un día intermedio).
 */
export const MAX_CALENDAR_GAP_DAYS_SAME_MENSTRUAL_PERIOD = 7;

/**
 * Inicio del **último episodio** de menstruación a partir de fechas de muestras
 * (p. ej. HealthKit). No usar solo la muestra más reciente: suele ser el último día
 * de sangrado; el día 1 del ciclo es el primero de ese episodio.
 *
 * Toma días civiles únicos, ordenados de reciente a antiguo, y agrupa mientras el
 * salto entre el día más nuevo del grupo y el siguiente día más antiguo sea ≤ `maxGapDays`.
 */
export function derivePeriodStartFromFlowSampleDates(
  sampleDates: Date[],
  maxGapDays: number = MAX_CALENDAR_GAP_DAYS_SAME_MENSTRUAL_PERIOD,
): Date | null {
  return derivePeriodStartsFromFlowSampleDates(sampleDates, maxGapDays, 1)[0] ?? null;
}

/** Máximo de episodios a reconstruir al estimar duración de ciclo. */
export const MAX_PERIOD_EPISODES_FOR_ESTIMATION = 8;

/**
 * Inicios de **todos los episodios** de menstruación (más reciente primero),
 * agrupando días de flujo con la misma regla de hueco que el episodio único.
 */
export function derivePeriodStartsFromFlowSampleDates(
  sampleDates: Date[],
  maxGapDays: number = MAX_CALENDAR_GAP_DAYS_SAME_MENSTRUAL_PERIOD,
  maxEpisodes: number = MAX_PERIOD_EPISODES_FOR_ESTIMATION,
): Date[] {
  const dayMillis = sampleDates
    .map((d) => startOfLocalCalendarDay(d).getTime())
    .filter((t) => !Number.isNaN(t));
  if (dayMillis.length === 0) return [];

  const uniqueNewestFirst = [...new Set(dayMillis)].sort((a, b) => b - a);
  const starts: Date[] = [];
  let clusterOldestMs = uniqueNewestFirst[0]!;

  for (let k = 1; k < uniqueNewestFirst.length; k++) {
    const olderMs = uniqueNewestFirst[k]!;
    const gap = localCalendarDaysBetween(new Date(olderMs), new Date(clusterOldestMs));
    if (gap > maxGapDays) {
      starts.push(new Date(clusterOldestMs));
      if (starts.length >= maxEpisodes) return starts;
      clusterOldestMs = olderMs;
    } else {
      clusterOldestMs = olderMs;
    }
  }
  starts.push(new Date(clusterOldestMs));
  return starts;
}

/** Rango plausible de duración de ciclo (días); fuera de esto el delta se descarta. */
export const MIN_PLAUSIBLE_CYCLE_DAYS = 21;
export const MAX_PLAUSIBLE_CYCLE_DAYS = 45;

/** Deltas usados como máximo para la mediana (ciclos más recientes pesan). */
const MAX_CYCLE_DELTAS_FOR_ESTIMATION = 6;

/**
 * Estima la duración del ciclo como **mediana** de los deltas entre inicios de
 * episodios consecutivos (más recientes primero), descartando deltas fuera de
 * [21, 45] días. Devuelve null con menos de 2 deltas válidos → el caller usa
 * `DEFAULT_CYCLE_LENGTH_DAYS`.
 */
export function estimateCycleLengthFromPeriodStarts(
  periodStartsNewestFirst: Date[],
): { days: number; cyclesUsed: number } | null {
  const deltas: number[] = [];
  for (let i = 0; i + 1 < periodStartsNewestFirst.length; i++) {
    const d = localCalendarDaysBetween(
      periodStartsNewestFirst[i + 1]!,
      periodStartsNewestFirst[i]!,
    );
    if (d >= MIN_PLAUSIBLE_CYCLE_DAYS && d <= MAX_PLAUSIBLE_CYCLE_DAYS) deltas.push(d);
    if (deltas.length >= MAX_CYCLE_DELTAS_FOR_ESTIMATION) break;
  }
  if (deltas.length < 2) return null;

  const sorted = [...deltas].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  return { days: median, cyclesUsed: deltas.length };
}

/** Suma días al **día civil local** de `date` (arroja mes/año como `setDate`). */
export function addLocalCalendarDays(date: Date, days: number): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const day = date.getDate();
  return new Date(y, m, day + days);
}

interface CycleConfig {
  cycleLength?: number; // días totales del ciclo (default 28)
  lutealLength?: number; // días fase lútea (default 14)
}

/**
 * Calcula la fase del ciclo dado el día del ciclo (1-based).
 * Fases aproximadas para un ciclo de 28 días:
 *   Menstrual:  días 1–5
 *   Folicular:  días 6–13
 *   Ovulación:  días 14–16
 *   Lútea:      días 17–28
 */
export function getPhaseFromCycleDay(cycleDay: number, config: CycleConfig = {}): CyclePhase {
  const { cycleLength = DEFAULT_CYCLE_LENGTH_DAYS, lutealLength = 14 } = config;
  const ovulationDay = cycleLength - lutealLength;

  if (cycleDay <= 5) return 'menstrual';
  if (cycleDay < ovulationDay - 1) return 'folicular';
  if (cycleDay <= ovulationDay + 1) return 'ovulacion';
  return 'lutea';
}

/**
 * Calcula el día del ciclo (1..cycleLength) a partir del inicio del último período y "hoy",
 * usando **días calendario locales** del dispositivo (medianoche local), no delta UTC fija.
 */
export function getCycleDayFromDate(
  lastPeriodStart: Date,
  targetDate: Date = new Date(),
  cycleLengthDays: number = DEFAULT_CYCLE_LENGTH_DAYS,
): number {
  const len =
    Number.isFinite(cycleLengthDays) && cycleLengthDays >= 1
      ? Math.round(cycleLengthDays)
      : DEFAULT_CYCLE_LENGTH_DAYS;
  const diff = localCalendarDaysBetween(lastPeriodStart, targetDate);
  const mod = ((diff % len) + len) % len;
  return mod + 1;
}

/**
 * Devuelve fase y día del ciclo para `targetDate` (por defecto el instante actual).
 */
export function getCurrentCycleInfo(
  lastPeriodStart: Date,
  config?: CycleConfig,
  targetDate: Date = new Date(),
): { phase: CyclePhase; day: number } {
  const day = getCycleDayFromDate(lastPeriodStart, targetDate, config?.cycleLength);
  return { phase: getPhaseFromCycleDay(day, config), day };
}

/** Refina fase/día con señales opcionales de Salud (ovulación, moco, BBT). */
export interface HealthKitPhaseRefinements {
  ovulationSignalDate: Date | null;
  peakFertileMucusDate: Date | null;
  bbtRiseAnchorDate: Date | null;
}

const EMPTY_REFINEMENTS: HealthKitPhaseRefinements = {
  ovulationSignalDate: null,
  peakFertileMucusDate: null,
  bbtRiseAnchorDate: null,
};

function localDayIndex(d: Date): number {
  return startOfLocalCalendarDay(d).getTime();
}

/** `today` cae en el intervalo inclusivo de días civiles desde `anchor` durante `spanDays` (0 = solo el día de anchor). */
function todayWithinLocalSpanFrom(anchor: Date, today: Date, spanDays: number): boolean {
  const t = localDayIndex(today);
  const a0 = localDayIndex(anchor);
  const a1 = localDayIndex(addLocalCalendarDays(anchor, spanDays));
  return t >= a0 && t <= a1;
}

/**
 * Partiendo del modelo de ciclo por `lastPeriodStart`, ajusta la fase si hay señales fuertes en Salud:
 * - Pico LH / estrógeno (test): ventana de 3 días civiles → `ovulacion`.
 * - Moco fértil (aguado / clara de huevo): misma ventana si el modelo base es folicular u ovulatorio.
 * - Subida térmica (BBT): primer día alto; si hoy está en los 10 días siguientes y el modelo aún es folicular/ovulatorio → `lutea`.
 */
export function getCurrentCycleInfoWithHealthKitRefinements(
  lastPeriodStart: Date,
  refinements: HealthKitPhaseRefinements | null | undefined,
  config?: CycleConfig,
  today: Date = new Date(),
): { phase: CyclePhase; day: number } {
  const r = refinements ?? EMPTY_REFINEMENTS;
  const base = getCurrentCycleInfo(lastPeriodStart, config, today);

  if (r.ovulationSignalDate && todayWithinLocalSpanFrom(r.ovulationSignalDate, today, 2)) {
    return { ...base, phase: 'ovulacion' };
  }

  if (
    r.peakFertileMucusDate &&
    todayWithinLocalSpanFrom(r.peakFertileMucusDate, today, 2) &&
    (base.phase === 'folicular' || base.phase === 'ovulacion')
  ) {
    return { ...base, phase: 'ovulacion' };
  }

  if (r.bbtRiseAnchorDate) {
    const daysSinceBbt = localCalendarDaysBetween(r.bbtRiseAnchorDate, today);
    if (
      daysSinceBbt >= 0 &&
      daysSinceBbt <= 10 &&
      (base.phase === 'folicular' || base.phase === 'ovulacion')
    ) {
      return { ...base, phase: 'lutea' };
    }
  }

  return base;
}

/**
 * Heurística simple de “subida” post-ovulación: media de los primeros días vs últimos 3 valores.
 * `unitIsFahrenheit` ajusta el umbral (~0,22 °F ≈ 0,12 °C).
 */
export function inferBbtRiseAnchorFromSamples(
  samples: readonly { date: Date; value: number }[],
  unitIsFahrenheit: boolean,
): Date | null {
  if (samples.length < 10) return null;
  const sorted = [...samples].sort((a, b) => a.date.getTime() - b.date.getTime());
  const riseMin = unitIsFahrenheit ? 0.22 : 0.12;

  const n = sorted.length;
  const earlyCount = Math.min(7, n - 6);
  if (earlyCount < 3) return null;

  let earlyMean = 0;
  for (let i = 0; i < earlyCount; i++) earlyMean += sorted[i]!.value;
  earlyMean /= earlyCount;

  const lateStart = n - 3;
  let lateMean = 0;
  for (let i = lateStart; i < n; i++) lateMean += sorted[i]!.value;
  lateMean /= 3;

  if (lateMean - earlyMean < riseMin) return null;
  return startOfLocalCalendarDay(sorted[lateStart]!.date);
}
