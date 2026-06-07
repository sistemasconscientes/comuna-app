import { normalizePhase } from './phaseUtils';

function normalizeAccentLower(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function monthToQuarter(month: number): 1 | 2 | 3 | 4 {
  if (month >= 1 && month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

function temporadaLabelMatchesInclusion(
  label: string,
  month: number,
  currentPhase: string,
): boolean {
  const n = normalizeAccentLower(label);
  if (n === 'todo el año' || n === 'todo el ano') return true;

  const compact = n.replace(/\s+/g, '');
  const qm = /^q([1-4])$/.exec(compact);
  if (qm && Number(qm[1]) === monthToQuarter(month)) return true;

  const phaseKey = normalizePhase(currentPhase);
  if (phaseKey === 'folicular' && n === 'fase folicular') return true;
  if (phaseKey === 'lutea' && n === 'fase lutea') return true;

  return false;
}

/** Misma regla OR por etiquetas que en `getSupplements` con filtro de temporada activo. */
export function supplementMatchesCurrentTemporada(
  temporadaLabels: string[],
  month: number,
  currentPhase: string,
): boolean {
  return temporadaLabels.some((lb) => temporadaLabelMatchesInclusion(lb, month, currentPhase));
}

export function filterSupplementsByCurrentTemporada<T extends { temporadaLabels: string[] }>(
  items: T[],
  currentPhase: string,
): T[] {
  const month = new Date().getMonth() + 1;
  return items.filter((s) =>
    supplementMatchesCurrentTemporada(s.temporadaLabels, month, currentPhase),
  );
}
