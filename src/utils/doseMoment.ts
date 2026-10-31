/**
 * Momento del día inferido del texto de dosis de Notion («200 mg por la
 * noche», «al desayuno», «en ayunas»…). Agrupar la lista por momento reduce
 * carga: se ve solo lo que toca ahora y en qué orden.
 */
export type DoseMoment = 'manana' | 'mediodia' | 'noche' | 'libre';

export const DOSE_MOMENT_ORDER: DoseMoment[] = ['manana', 'mediodia', 'noche', 'libre'];

export const DOSE_MOMENT_LABEL: Record<DoseMoment, string> = {
  manana: 'Mañana',
  mediodia: 'Mediodía y tarde',
  noche: 'Noche',
  libre: 'Cuando quieras',
};

const RULES: [DoseMoment, RegExp][] = [
  ['noche', /\b(noche|nocturn|antes de dormir|al dormir|cena|night|bedtime|dinner)\b/],
  ['manana', /\b(manana|ayunas|desayuno|al despertar|morning|breakfast|empty stomach)\b/],
  ['mediodia', /\b(mediodia|comida|almuerzo|tarde|lunch|afternoon|noon)\b/],
];

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function doseMoment(dose: string): DoseMoment {
  const n = normalize(dose);
  for (const [moment, re] of RULES) if (re.test(n)) return moment;
  return 'libre';
}

/** Agrupa preservando el orden original dentro de cada momento; omite grupos vacíos. */
export function groupByMoment<T extends { dose: string }>(
  items: T[],
): { moment: DoseMoment; items: T[] }[] {
  const map = new Map<DoseMoment, T[]>();
  for (const it of items) {
    const m = doseMoment(it.dose);
    map.set(m, [...(map.get(m) ?? []), it]);
  }
  return DOSE_MOMENT_ORDER.filter((m) => map.has(m)).map((m) => ({
    moment: m,
    items: map.get(m)!,
  }));
}

/** Momento sugerido según la hora local (para resaltar «lo de ahora»). */
export function currentMoment(now = new Date()): DoseMoment {
  const h = now.getHours();
  if (h < 12) return 'manana';
  if (h < 19) return 'mediodia';
  return 'noche';
}
