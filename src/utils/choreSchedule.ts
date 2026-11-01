/**
 * Qué tareas del hogar tocan en un día y en qué estado están. Sin I/O.
 *
 * - Con días fijos (`weekdays`): toca esos días de la semana.
 * - Sin días fijos: toca cuando pasó el intervalo de su frecuencia desde la
 *   última vez (o nunca se hizo). Si se atrasa, sigue apareciendo con los
 *   días de atraso hasta que alguien la marque.
 */
import type { Chore, ChoreFrequency } from '../types';

export const FREQUENCY_INTERVAL_DAYS: Record<Exclude<ChoreFrequency, 'cada_n_dias'>, number> = {
  diaria: 1,
  semanal: 7,
  quincenal: 14,
  mensual: 30,
};

export const FREQUENCY_LABEL: Record<ChoreFrequency, string> = {
  diaria: 'Diaria',
  semanal: 'Semanal',
  quincenal: 'Cada 2 semanas',
  mensual: 'Mensual',
  cada_n_dias: 'Cada N días',
};

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Texto del select `Frecuencia` → frecuencia (null si no se reconoce). */
export function parseFrequency(raw: string): ChoreFrequency | null {
  const n = normalize(raw);
  if (!n) return null;
  if (/^(diari|todos los dias|cada dia|daily)/.test(n)) return 'diaria';
  if (/(quincenal|cada 2 semanas|cada dos semanas|biweekly)/.test(n)) return 'quincenal';
  if (/^(semanal|cada semana|weekly)/.test(n)) return 'semanal';
  if (/^(mensual|cada mes|monthly)/.test(n)) return 'mensual';
  if (/cada\s*\d+\s*dias?|cada n dias/.test(n)) return 'cada_n_dias';
  return null;
}

/** «Cada 3 días» → 3 (si el número viene en el propio texto de la frecuencia). */
export function everyNFromText(raw: string): number | null {
  const m = /cada\s*(\d+)\s*dias?/.exec(normalize(raw));
  return m ? Number(m[1]) : null;
}

const WEEKDAY_ALIASES: [number, string[]][] = [
  [1, ['lun', 'lunes', 'mon', 'monday']],
  [2, ['mar', 'martes', 'tue', 'tuesday']],
  [3, ['mie', 'miercoles', 'wed', 'wednesday']],
  [4, ['jue', 'jueves', 'thu', 'thursday']],
  [5, ['vie', 'viernes', 'fri', 'friday']],
  [6, ['sab', 'sabado', 'sat', 'saturday']],
  [0, ['dom', 'domingo', 'sun', 'sunday']],
];

/** Opciones del multi-select `Días` → números de día (0 = domingo). */
export function parseWeekdays(labels: string[]): number[] {
  const out = new Set<number>();
  for (const label of labels) {
    const n = normalize(label).replace(/\./g, '');
    const hit = WEEKDAY_ALIASES.find(([, aliases]) => aliases.includes(n));
    if (hit) out.add(hit[0]);
  }
  return [...out].sort();
}

export function intervalDays(chore: Pick<Chore, 'frequency' | 'everyNDays'>): number {
  if (chore.frequency === 'cada_n_dias') return Math.max(1, chore.everyNDays ?? 1);
  return FREQUENCY_INTERVAL_DAYS[chore.frequency];
}

function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Días civiles entre dos fechas `YYYY-MM-DD` (b − a). */
export function daysBetweenISO(a: string, b: string): number {
  return Math.round((isoToLocalDate(b).getTime() - isoToLocalDate(a).getTime()) / 86_400_000);
}

export interface ChoreDayStatus {
  /** Aparece en la lista del día. */
  visible: boolean;
  doneToday: boolean;
  /** Días de atraso (0 = toca hoy justo). */
  overdueDays: number;
}

export function choreStatusForDay(
  chore: Pick<Chore, 'frequency' | 'everyNDays' | 'weekdays' | 'lastDone'>,
  todayISO: string,
): ChoreDayStatus {
  const doneToday = chore.lastDone === todayISO;
  if (doneToday) return { visible: true, doneToday: true, overdueDays: 0 };

  if (chore.weekdays.length) {
    const dow = isoToLocalDate(todayISO).getDay();
    return { visible: chore.weekdays.includes(dow), doneToday: false, overdueDays: 0 };
  }

  if (!chore.lastDone) return { visible: true, doneToday: false, overdueDays: 0 };
  const since = daysBetweenISO(chore.lastDone, todayISO);
  const interval = intervalDays(chore);
  if (since < interval) return { visible: false, doneToday: false, overdueDays: 0 };
  return { visible: true, doneToday: false, overdueDays: since - interval };
}

/** Cuándo vuelve a tocar (para «Próximas»), o null si depende de días fijos. */
export function nextDueISO(
  chore: Pick<Chore, 'frequency' | 'everyNDays' | 'weekdays' | 'lastDone'>,
): string | null {
  if (chore.weekdays.length || !chore.lastDone) return null;
  const d = isoToLocalDate(chore.lastDone);
  d.setDate(d.getDate() + intervalDays(chore));
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
