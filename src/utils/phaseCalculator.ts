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
export function getPhaseFromCycleDay(
  cycleDay: number,
  config: CycleConfig = {}
): CyclePhase {
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
 * Devuelve fase y día del ciclo para hoy.
 */
export function getCurrentCycleInfo(
  lastPeriodStart: Date,
  config?: CycleConfig
): { phase: CyclePhase; day: number } {
  const day = getCycleDayFromDate(lastPeriodStart);
  return { phase: getPhaseFromCycleDay(day, config), day };
}
