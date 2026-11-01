/**
 * «Energía disponible» del día a partir del sueño de Apple Salud, ajustada a la
 * fase del ciclo en perfiles que lo siguen. Orientativo: no es una medición
 * clínica. Sin I/O: `src/api/healthkit.ts` trae los intervalos.
 *
 * Ajuste por fase (personas que menstrúan, sin anticonceptivo hormonal,
 * embarazo ni lactancia):
 * - Referencia **de la misma fase**: tu sueño habitual cambia a lo largo del
 *   ciclo, así que se compara la noche con tus noches previas en esa fase.
 * - Lútea y menstrual: la progesterona sube la temperatura corporal y el
 *   sueño suele ser más fragmentado (más despertares, menos REM), y en los
 *   días premenstruales y los primeros de la regla la calidad percibida baja.
 *   Las mismas horas rinden menos, así que los umbrales piden un poco más.
 */
import type { CyclePhase, HealthKitLifecycleContext } from '../types';
import { mergeIntervalsTotalMs, type MsInterval } from './healthObservation';

export type EnergyLevel = 'baja' | 'media' | 'alta';

/** Contra qué se comparó la noche. */
export type EnergyBaselineKind = 'fase' | 'personal' | 'referencia';

export interface EnergyEstimate {
  level: EnergyLevel;
  lastNightMs: number;
  /** Referencia contra la que se compara (fase, tu mediana o 7 h 30). */
  baselineMs: number;
  baselineKind: EnergyBaselineKind;
  /** `true` si los umbrales se ajustaron por fase lútea/menstrual. */
  phaseAdjusted: boolean;
  /** Una frase concreta y corta para el día. */
  suggestion: string;
  /** Matiz por fase (solo perfiles con ciclo); null si no aplica. */
  phaseNote: string | null;
}

export interface EnergyCycleContext {
  /** Fase de hoy. */
  phase: CyclePhase;
  /** Fase estimada de una noche pasada (clave `YYYY-MM-DD`), o null si no se sabe. */
  phaseOfNight?: (night: string) => CyclePhase | null;
  /** Contexto de Salud: con anticonceptivo hormonal, embarazo o lactancia no se ajusta por fase. */
  lifecycleContext?: HealthKitLifecycleContext;
}

/** Desplazamiento para asignar cada tramo a la noche del día en que despiertas. */
const NIGHT_SHIFT_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_SLEEP_BASELINE_MS = 7.5 * 60 * 60 * 1000;
/** Noches previas mínimas para usar tu propia mediana como referencia. */
const MIN_NIGHTS_FOR_BASELINE = 5;
/** Noches previas en la misma fase para usar la mediana de fase. */
const MIN_NIGHTS_FOR_PHASE_BASELINE = 4;
/** Ventana de noches para la referencia (cubre ~2 ciclos para la mediana por fase). */
export const ENERGY_LOOKBACK_NIGHTS = 60;
const HOUR = 60 * 60 * 1000;

/** Umbrales (proporción de la referencia y horas absolutas). */
interface Thresholds {
  lowRatio: number;
  midRatio: number;
  lowHours: number;
  midHours: number;
}

const BASE_THRESHOLDS: Thresholds = { lowRatio: 0.8, midRatio: 0.92, lowHours: 5, midHours: 6.5 };
/** Lútea/menstrual: sueño más fragmentado → se pide algo más para «alta». */
const SENSITIVE_PHASE_THRESHOLDS: Thresholds = {
  lowRatio: 0.85,
  midRatio: 0.97,
  lowHours: 5.5,
  midHours: 7,
};

const SENSITIVE_PHASES: CyclePhase[] = ['lutea', 'menstrual'];

function localDateKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** `YYYY-MM-DD` → fecha local a mediodía (evita bordes de horario de verano). */
export function nightKeyToDate(night: string): Date {
  const [y, m, d] = night.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
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
  lutea:
    'Fase lútea: la temperatura corporal sube y el sueño suele ser más ligero y con más despertares; las mismas horas pueden rendir menos.',
  menstrual:
    'Fase menstrual: es común dormir peor los primeros días (molestias, cambios hormonales); date margen.',
  folicular: 'Fase folicular: suele ser cuando el sueño se siente más reparador.',
};

/** Contextos en los que el patrón de sueño por fase no aplica. */
function phasePatternApplies(ctx: EnergyCycleContext | null | undefined): boolean {
  if (!ctx) return false;
  const lc = ctx.lifecycleContext ?? 'none';
  return lc === 'none';
}

/**
 * Nivel de energía comparando la última noche con tu referencia (de la misma
 * fase si hay datos). Umbrales base: < 5 h o < 80 % → baja; < 6 h 30 o < 92 %
 * → media; si no, alta. En lútea/menstrual: 5 h 30 / 85 % y 7 h / 97 %.
 */
export function estimateEnergy(
  nights: { night: string; asleepMs: number }[],
  todayKey: string,
  cycle: EnergyCycleContext | null = null,
): EnergyEstimate | null {
  const last = nights.find((n) => n.night === todayKey);
  if (!last) return null;
  const previous = nights.filter((n) => n.night < todayKey).slice(0, ENERGY_LOOKBACK_NIGHTS);
  const usePhase = phasePatternApplies(cycle);

  let baselineMs = DEFAULT_SLEEP_BASELINE_MS;
  let baselineKind: EnergyBaselineKind = 'referencia';
  const samePhase =
    usePhase && cycle?.phaseOfNight
      ? previous.filter((n) => cycle.phaseOfNight!(n.night) === cycle.phase)
      : [];
  if (samePhase.length >= MIN_NIGHTS_FOR_PHASE_BASELINE) {
    baselineMs = median(samePhase.map((n) => n.asleepMs));
    baselineKind = 'fase';
  } else {
    // Sin fase suficiente: últimas 14 noches (tu sueño reciente).
    const recent = previous.slice(0, 14);
    if (recent.length >= MIN_NIGHTS_FOR_BASELINE) {
      baselineMs = median(recent.map((n) => n.asleepMs));
      baselineKind = 'personal';
    }
  }

  const phaseAdjusted = usePhase && !!cycle && SENSITIVE_PHASES.includes(cycle.phase);
  const t = phaseAdjusted ? SENSITIVE_PHASE_THRESHOLDS : BASE_THRESHOLDS;
  const ratio = last.asleepMs / baselineMs;

  let level: EnergyLevel;
  if (last.asleepMs < t.lowHours * HOUR || ratio < t.lowRatio) level = 'baja';
  else if (last.asleepMs < t.midHours * HOUR || ratio < t.midRatio) level = 'media';
  else level = 'alta';

  let phaseNote: string | null = null;
  if (cycle) {
    phaseNote = usePhase
      ? (PHASE_NOTES[cycle.phase] ?? null)
      : 'Con anticonceptivo hormonal, embarazo o lactancia el patrón de sueño por fase cambia: usamos tu sueño general.';
  }

  return {
    level,
    lastNightMs: last.asleepMs,
    baselineMs,
    baselineKind,
    phaseAdjusted,
    suggestion: SUGGESTIONS[level],
    phaseNote,
  };
}

export function todayNightKey(now = new Date()): string {
  return localDateKey(now.getTime());
}
