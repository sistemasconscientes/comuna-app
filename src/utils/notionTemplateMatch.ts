/**
 * Matching puro de los objetos del template de Notion (DB Suplementos, página
 * de Fases, hub de Comidas, BD de Tés) a partir de títulos devueltos por la
 * search API. Sin I/O: `src/api/notion.ts` orquesta las llamadas.
 */

export interface NotionSearchItem {
  id: string;
  title: string;
}

/**
 * Palabras de encabezado de la columna persona en la tabla de fases («Persona /
 * Fase / Próximo ciclo» escrita como fila normal). Compartido entre el
 * detector (notion.ts) y el saneo de overrides de perfil (profiles.ts).
 */
export const PHASE_HEADER_FIRST_CELL_WORDS = [
  'persona',
  'nombre',
  'usuario',
  'perfil',
  'quien',
] as const;

export function normalizeHeaderWord(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** ¿El texto es una palabra de encabezado y no un nombre real? */
export function isPhaseHeaderWord(text: string): boolean {
  return (PHASE_HEADER_FIRST_CELL_WORDS as readonly string[]).includes(normalizeHeaderWord(text));
}

export interface NotionTemplateMatches {
  supplementsDbId: string;
  teasDbId: string;
  /** Candidatas ordenadas; el caller verifica cuál tiene la tabla inline. */
  phasesPageCandidates: NotionSearchItem[];
  /** Candidatas ordenadas; el caller verifica el heading "Comidas Activas". */
  mealPrepHubCandidates: NotionSearchItem[];
}

function titleTokens(input: string): string[] {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** ¿Algún token del título empieza con el prefijo? ("Suplementos 2026" ~ 'suplement'). */
function hasTokenPrefix(title: string, prefix: string): boolean {
  return titleTokens(title).some((t) => t.startsWith(prefix));
}

/** ¿Algún token es exactamente una de las palabras? ("Tés" → 'tes'; evita "template"). */
function hasExactToken(title: string, words: string[]): boolean {
  return titleTokens(title).some((t) => words.includes(t));
}

/** Prioriza título de un solo token, luego orden de la búsqueda — determinista ante duplicados. */
function pickBest(matches: NotionSearchItem[]): NotionSearchItem | undefined {
  return matches.find((i) => titleTokens(i.title).length === 1) ?? matches[0];
}

export function matchNotionTemplate(
  databases: NotionSearchItem[],
  pages: NotionSearchItem[],
): NotionTemplateMatches {
  const supplementsDb = pickBest(databases.filter((d) => hasTokenPrefix(d.title, 'suplement')));
  const teasDb = pickBest(databases.filter((d) => hasExactToken(d.title, ['te', 'tes'])));

  const phasesPageCandidates = pages.filter((p) => hasTokenPrefix(p.title, 'fase'));
  const mealPrepHubCandidates = pages.filter(
    (p) => hasTokenPrefix(p.title, 'comida') || hasTokenPrefix(p.title, 'cocina'),
  );

  return {
    supplementsDbId: supplementsDb?.id ?? '',
    teasDbId: teasDb?.id ?? '',
    phasesPageCandidates,
    mealPrepHubCandidates,
  };
}
