import type { CyclePhase } from '../types';

/** Longitud del ciclo en días (modelo por defecto; ver `getPhaseFromCycleDay` sin config). */
export const DEFAULT_CYCLE_LENGTH_DAYS = 28;

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
 * Calcula el día del ciclo a partir de la fecha de inicio del último período.
 */
export function getCycleDayFromDate(lastPeriodStart: Date, targetDate: Date = new Date()): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.floor((targetDate.getTime() - lastPeriodStart.getTime()) / msPerDay);
  return (diff % DEFAULT_CYCLE_LENGTH_DAYS) + 1;
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
