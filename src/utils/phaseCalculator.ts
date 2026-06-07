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
  if (sampleDates.length === 0) return null;
  const dayMillis = sampleDates
    .map((d) => startOfLocalCalendarDay(d).getTime())
    .filter((t) => !Number.isNaN(t));
  if (dayMillis.length === 0) return null;

  const uniqueNewestFirst = [...new Set(dayMillis)].sort((a, b) => b - a);
  const cluster: number[] = [uniqueNewestFirst[0]!];

  for (let k = 1; k < uniqueNewestFirst.length; k++) {
    const olderMs = uniqueNewestFirst[k]!;
    const newestInClusterMs = cluster[0]!;
    const gap = localCalendarDaysBetween(new Date(olderMs), new Date(newestInClusterMs));
    if (gap > maxGapDays) break;
    cluster.push(olderMs);
  }

  const oldestMs = cluster[cluster.length - 1]!;
  return new Date(oldestMs);
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
 * Calcula el día del ciclo (1..28) a partir del inicio del último período y "hoy",
 * usando **días calendario locales** del dispositivo (medianoche local), no delta UTC fija.
 */
export function getCycleDayFromDate(lastPeriodStart: Date, targetDate: Date = new Date()): number {
  const diff = localCalendarDaysBetween(lastPeriodStart, targetDate);
  const mod =
    ((diff % DEFAULT_CYCLE_LENGTH_DAYS) + DEFAULT_CYCLE_LENGTH_DAYS) % DEFAULT_CYCLE_LENGTH_DAYS;
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
  const day = getCycleDayFromDate(lastPeriodStart, targetDate);
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
