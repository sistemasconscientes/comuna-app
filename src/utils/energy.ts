/**
 * «Energía disponible» del día a partir del sueño de Apple Salud (y, si el
 * perfil sigue ciclo, un matiz por fase). Orientativo: no es una medición
 * clínica. Sin I/O: `src/api/healthkit.ts` trae los intervalos.
 */
import type { CyclePhase } from '../types';
import { mergeIntervalsTotalMs, type MsInterval } from './healthObservation';

export type EnergyLevel = 'baja' | 'media' | 'alta';

export interface EnergyEstimate {
  level: EnergyLevel;
  lastNightMs: number;
  /** Referencia contra la que se compara: tu mediana o 7 h 30 si hay pocas noches. */
  baselineMs: number;
  usedPersonalBaseline: boolean;
  /** Una frase concreta y corta para el día. */
  suggestion: string;
  /** Matiz por fase (solo perfiles con ciclo); null si no aplica. */
  phaseNote: string | null;
}

/** Desplazamiento para asignar cada tramo a la noche del día en que despiertas. */
const NIGHT_SHIFT_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_SLEEP_BASELINE_MS = 7.5 * 60 * 60 * 1000;
/** Noches previas mínimas para usar tu propia mediana como referencia. */
const MIN_NIGHTS_FOR_BASELINE = 5;
const HOUR = 60 * 60 * 1000;

function localDateKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Agrupa tramos dormida por «noche» (día civil de despertar: inicio + 6 h) y
 * fusiona solapes entre fuentes. Orden: más reciente primero.
 */
export function groupSleepByNight(intervals: MsInterval[]): { night: string; asleepMs: number }[] {
  const byNight = new Map<string, MsInterval[]>();
  for (const i of intervals) {
    const key = localDateKey(i.startMs + NIGHT_SHIFT_MS);
    const list = byNight.get(key) ?? [];
    list.push(i);
    byNight.set(key, list);
  }
  return [...byNight.entries()]
    .map(([night, list]) => ({ night, asleepMs: mergeIntervalsTotalMs(list) }))
    .filter((n) => n.asleepMs > 0)
    .sort((a, b) => (a.night < b.night ? 1 : -1));
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const SUGGESTIONS: Record<EnergyLevel, string> = {
  baja: 'Día de mínimos: lo esencial, pausas cortas y nada de exigirte de más.',
  media: 'Energía media: elige 1 o 2 cosas importantes y deja el resto para después.',
  alta: 'Descansaste bien: buen día para lo que pide más foco.',
};

const PHASE_NOTES: Partial<Record<CyclePhase, string>> = {
  menstrual: 'En fase menstrual es común notar menos energía; date margen.',
  lutea: 'En fase lútea el descanso suele pesar más de lo normal.',
};

/**
 * Nivel de energía comparando la última noche con tu referencia:
 * < 5 h o < 80 % de tu referencia → baja; < 6 h 30 o < 92 % → media; si no, alta.
 * La fase solo agrega un matiz de texto (no cambia el nivel).
 */
export function estimateEnergy(
  nights: { night: string; asleepMs: number }[],
  todayKey: string,
  phase: CyclePhase | null = null,
): EnergyEstimate | null {
  const last = nights.find((n) => n.night === todayKey);
  if (!last) return null;
  const previous = nights.filter((n) => n.night < todayKey).slice(0, 14);
  const usedPersonalBaseline = previous.length >= MIN_NIGHTS_FOR_BASELINE;
  const baselineMs = usedPersonalBaseline
    ? median(previous.map((n) => n.asleepMs))
    : DEFAULT_SLEEP_BASELINE_MS;
  const ratio = last.asleepMs / baselineMs;

  let level: EnergyLevel;
  if (last.asleepMs < 5 * HOUR || ratio < 0.8) level = 'baja';
  else if (last.asleepMs < 6.5 * HOUR || ratio < 0.92) level = 'media';
  else level = 'alta';

  return {
    level,
    lastNightMs: last.asleepMs,
    baselineMs,
    usedPersonalBaseline,
    suggestion: SUGGESTIONS[level],
    phaseNote: phase ? (PHASE_NOTES[phase] ?? null) : null,
  };
}

export function todayNightKey(now = new Date()): string {
  return localDateKey(now.getTime());
}
