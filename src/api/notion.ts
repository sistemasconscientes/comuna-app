import type { ProfileId } from '../config/profiles';
import { getNotionPhaseRowLabel, getNotionSupplementPersona } from '../config/profiles';
import { getNotionSettings, getNotionSettingsSource } from '../config/notionSettings';
import { matchNotionTemplate, type NotionSearchItem } from '../utils/notionTemplateMatch';
import type { Phase, Supplement, SupplementPersona, Tea } from '../types';
import { normalizePhase } from '../utils/phaseUtils';
import { supplementMatchesCurrentTemporada } from '../utils/temporadaFilter';

const BASE_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function baseHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

/** Error de la API de Notion con el status y un extracto (truncado) del cuerpo. */
export class NotionApiError extends Error {
  constructor(
    readonly status: number,
    readonly bodySnippet: string,
  ) {
    super(`Notion API error ${status}: ${bodySnippet}`);
    this.name = 'NotionApiError';
  }
}

/** 5xx y 429 se reintentan; 4xx (salvo 429) son del cliente y no tiene sentido reintentar. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/** Parsea el header `Retry-After` (segundos o fecha HTTP) a milisegundos. */
export function parseRetryAfterMs(header: string | null, now: number = Date.now()): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  const secs = Number(trimmed);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(trimmed);
  if (!Number.isNaN(when)) return Math.max(0, when - now);
  return null;
}

/** Backoff exponencial con jitter, acotado a 10s. */
export function backoffMs(attempt: number, baseMs: number, rand: number = Math.random()): number {
  const exp = baseMs * 2 ** attempt;
  const jitter = exp * 0.5 * rand;
  return Math.min(exp + jitter, 10_000);
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 400;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export type RetryConfig = { retries: number; baseDelayMs: number };

/**
 * Ejecuta `doFetch` con reintentos: red caída y 5xx/429 se reintentan (backoff +
 * jitter, respetando `Retry-After`); 4xx se devuelven tal cual para que el caller
 * decida. Independiente de credenciales para poder testearse aislado.
 */
export async function fetchWithRetry(
  doFetch: () => Promise<Response>,
  retry: RetryConfig = { retries: MAX_RETRIES, baseDelayMs: BASE_DELAY_MS },
): Promise<Response> {
  let lastError: Error = new Error('fetch failed');
  for (let attempt = 0; attempt <= retry.retries; attempt++) {
    let res: Response;
    try {
      res = await doFetch();
    } catch (networkErr) {
      // Error de red (sin conexión, timeout): reintentable.
      lastError = networkErr instanceof Error ? networkErr : new Error(String(networkErr));
      if (attempt < retry.retries) {
        await sleep(backoffMs(attempt, retry.baseDelayMs));
        continue;
      }
      throw lastError;
    }

    if (res.ok || !isRetryableStatus(res.status) || attempt >= retry.retries) return res;

    const retryAfter = parseRetryAfterMs(res.headers.get('retry-after'));
    await sleep(retryAfter ?? backoffMs(attempt, retry.baseDelayMs));
  }
  throw lastError;
}

/**
 * Token temporal para el onboarding: permite ejercitar el cliente completo con
 * un token aún no guardado. Scoped y secuencial (el gate bloquea el resto de la
 * app mientras corre), así que no hay llamadas concurrentes que lo pisen.
 */
let apiKeyOverride: string | null = null;

export async function withNotionApiKey<T>(apiKey: string, fn: () => Promise<T>): Promise<T> {
  apiKeyOverride = apiKey.trim();
  try {
    return await fn();
  } finally {
    apiKeyOverride = null;
  }
}

export async function notionFetch<T>(
  path: string,
  options?: RequestInit,
  retry: RetryConfig = { retries: MAX_RETRIES, baseDelayMs: BASE_DELAY_MS },
): Promise<T> {
  const apiKey = apiKeyOverride ?? getNotionSettings().apiKey;
  if (!apiKey) throw new Error('Missing NOTION_API_KEY');
  const mergedHeaders: Record<string, string> = {
    ...baseHeaders(apiKey),
    ...(options?.headers as Record<string, string> | undefined),
  };

  const res = await fetchWithRetry(
    () => fetch(`${BASE_URL}${path}`, { ...options, headers: mergedHeaders }),
    retry,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new NotionApiError(res.status, body.slice(0, 500));
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types (minimal subset of Notion API responses we need)
// ─────────────────────────────────────────────────────────────────────────────

type NotionId = string;

interface NotionRichText {
  plain_text?: string;
  type?: 'text';
  text?: { content: string };
}

type NotionCell = NotionRichText[];

interface NotionPropertyValue {
  type: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  select?: { name: string } | null;
  multi_select?: { name: string }[];
  checkbox?: boolean;
}

interface NotionDatabaseQueryResponse {
  results: { id: NotionId; properties: Record<string, NotionPropertyValue> }[];
  has_more: boolean;
  next_cursor: string | null;
}

interface NotionBlockBase {
  id: NotionId;
  type: string;
}

interface NotionTableRowBlock extends NotionBlockBase {
  type: 'table_row';
  table_row: { cells: NotionCell[] };
}

interface NotionTableBlock extends NotionBlockBase {
  type: 'table';
  table: { table_width: number; has_column_header: boolean; has_row_header: boolean };
}

type NotionBlock =
  | NotionTableBlock
  | NotionTableRowBlock
  | (NotionBlockBase & Record<string, unknown>);

interface NotionListResponse<T> {
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Exige un ID presente en la config runtime (guardada u `.env`). */
function requireSetting(name: string, value: string): string {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function richTextToPlainText(rich: NotionRichText[] | undefined): string {
  return (rich ?? []).map((r) => r.plain_text ?? '').join('');
}

function cellToText(cell: NotionCell | undefined): string {
  return richTextToPlainText(cell);
}

function normalizePersonName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * El filtro del query garantiza Persona == persona del perfil o 'Ambas', así
 * que el raw se respeta tal cual (nombres arbitrarios en workspaces ajenos).
 */
function parseSupplementPersona(raw: string): SupplementPersona {
  return raw.trim() || 'Ambas';
}

function parseDateLoose(input: string): Date {
  const s = input.trim();
  // YYYY-MM-DD = día civil local (coherente con `toDeviceCalendarISODate` al escribir)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const mo = Number(isoMatch[2]) - 1;
    const da = Number(isoMatch[3]);
    const d = new Date(y, mo, da);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const dmyMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (dmyMatch) {
    const da = Number(dmyMatch[1]);
    const mo = Number(dmyMatch[2]) - 1;
    const y = Number(dmyMatch[3]);
    const d = new Date(y, mo, da);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: "${input}"`);
  return d;
}

/** Fecha de la tabla de fases: `YYYY-MM-DD` según calendario local del dispositivo. */
function toDeviceCalendarISODate(date: Date): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid Date');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pickProp(
  props: Record<string, NotionPropertyValue>,
  names: string[],
): NotionPropertyValue | undefined {
  for (const name of names) {
    const v = props[name];
    if (v) return v;
  }
  return undefined;
}

function propText(props: Record<string, NotionPropertyValue>, names: string[]): string {
  const prop = pickProp(props, names);
  if (!prop) return '';
  if (prop.type === 'title') return richTextToPlainText(prop.title);
  if (prop.type === 'rich_text') return richTextToPlainText(prop.rich_text);
  if (prop.type === 'select') return prop.select?.name ?? '';
  if (prop.type === 'multi_select') return (prop.multi_select ?? []).map((x) => x.name).join(', ');
  return '';
}

function propMultiSelect(props: Record<string, NotionPropertyValue>, names: string[]): string[] {
  const prop = pickProp(props, names);
  if (!prop) return [];
  if (prop.type === 'multi_select') return (prop.multi_select ?? []).map((x) => x.name);
  // Allow single select as 1-element category
  if (prop.type === 'select' && prop.select?.name) return [prop.select.name];
  return [];
}

function propCheckbox(
  props: Record<string, NotionPropertyValue>,
  names: string[],
  fallback: boolean,
): boolean {
  const prop = pickProp(props, names);
  if (!prop) return fallback;
  if (prop.type === 'checkbox') return prop.checkbox ?? fallback;
  return fallback;
}

/** Etiquetas de Temporada: misma prioridad que `seasonRaw` (texto si existe; si no, multi-select). */
function temporadaLabelsFromProps(props: Record<string, NotionPropertyValue>): string[] {
  const text = propText(props, ['Temporada', 'Season']).trim();
  if (text)
    return text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  return propMultiSelect(props, ['Temporada', 'Season'])
    .map((s) => s.trim())
    .filter(Boolean);
}

async function queryDatabaseAll(databaseId: string, body: Record<string, unknown>) {
  const results: NotionDatabaseQueryResponse['results'] = [];
  let cursor: string | null | undefined = undefined;
  while (true) {
    const page: NotionDatabaseQueryResponse = await notionFetch(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({ ...body, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    results.push(...page.results);
    if (!page.has_more) break;
    cursor = page.next_cursor;
    if (!cursor) break;
  }
  return results;
}

async function listBlockChildrenAll(blockId: string): Promise<NotionBlock[]> {
  const out: NotionBlock[] = [];
  let cursor: string | null | undefined = undefined;
  while (true) {
    const resp: NotionListResponse<NotionBlock> = await notionFetch(
      `/blocks/${blockId}/children${cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : ''}`,
    );
    out.push(...resp.results);
    if (!resp.has_more) break;
    cursor = resp.next_cursor;
    if (!cursor) break;
  }
  return out;
}

/** Una sola página de resultados (no sigue `next_cursor`). */
async function listBlockChildrenPage(blockId: string, pageSize: number): Promise<NotionBlock[]> {
  const q = new URLSearchParams({ page_size: String(pageSize) });
  const resp: NotionListResponse<NotionBlock> = await notionFetch(
    `/blocks/${encodeURIComponent(blockId)}/children?${q.toString()}`,
  );
  return resp.results;
}

function heading2PlainText(block: NotionBlock): string {
  if (block.type !== 'heading_2') return '';
  const rich = (block as { heading_2?: { rich_text?: NotionRichText[] } }).heading_2?.rich_text;
  return richTextToPlainText(rich).trim();
}

function textCell(content: string): NotionCell {
  return content ? [{ type: 'text', text: { content } }] : [];
}

/** Texto con emoji escrito en la columna de fase de la tabla inline en Notion. */
const PHASE_TO_LABEL: Record<string, string> = {
  menstrual: 'Menstruación 🩸',
  folicular: 'Folicular 🌸',
  ovulatoria: 'Ovulación 🥵',
  ovulacion: 'Ovulación 🥵',
  lutea: 'Lútea 🦥',
};

function phaseKeyToNotionLabel(phase: string): string {
  const key = phase.trim().toLowerCase();
  return PHASE_TO_LABEL[key] ?? phase;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function getSupplements(
  user: ProfileId,
  currentPhase: string,
  applyTemporadaFilter = true,
): Promise<Supplement[]> {
  const dbId = requireSetting('NOTION_SUPPLEMENTS_DB_ID', getNotionSettings().supplementsDbId);

  const personaValue = getNotionSupplementPersona(user);

  const filter = {
    and: [
      { property: 'Disponible', checkbox: { equals: true } },
      {
        or: [
          { property: 'Persona', select: { equals: personaValue } },
          { property: 'Persona', select: { equals: 'Ambas' } },
        ],
      },
    ],
  };

  const pages = await queryDatabaseAll(dbId, { filter });
  const month = new Date().getMonth() + 1;
  const sourcePages = applyTemporadaFilter
    ? pages.filter((p) =>
        supplementMatchesCurrentTemporada(
          temporadaLabelsFromProps(p.properties),
          month,
          currentPhase,
        ),
      )
    : pages;

  return sourcePages.map((p) => {
    const props = p.properties;

    const name = propText(props, ['Name', 'Nombre']).trim();
    const dose = propText(props, ['Dose', 'Dosis']).trim();
    const category = propMultiSelect(props, ['Category', 'Categoría', 'Categoria']);
    const temporadaLabels = temporadaLabelsFromProps(props);

    const seasonRaw =
      propText(props, ['Temporada', 'Season']).trim() ||
      propMultiSelect(props, ['Temporada', 'Season']).join(', ').trim();

    const normalized = normalizePhase(seasonRaw) ?? 'all';
    const persona = parseSupplementPersona(propText(props, ['Persona']));

    return {
      notion_id: p.id,
      name,
      category,
      dose,
      phase_specific: normalized,
      temporadaLabels,
      persona,
    };
  });
}

export async function markForRestock(notion_id: string): Promise<void> {
  if (!notion_id) return;
  await notionFetch(`/pages/${encodeURIComponent(notion_id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: {
        'Recompra?': { checkbox: true },
      },
    }),
  });
}

export async function getMealPrep(): Promise<{
  title: string;
  pageId: string;
  blocks: any[];
} | null> {
  const hubId = getNotionSettings().mealPrepHubPageId;
  if (!hubId) return null;
  const hubBlocks = await listBlockChildrenAll(hubId);
  const h2Index = hubBlocks.findIndex(
    (b) => b.type === 'heading_2' && heading2PlainText(b) === 'Comidas Activas',
  );
  if (h2Index === -1) return null;

  const child = hubBlocks.slice(h2Index + 1).find((b) => b.type === 'child_page') as
    | (NotionBlockBase & { type: 'child_page'; child_page: { title?: string } })
    | undefined;
  if (!child?.child_page) return null;

  const title = child.child_page.title ?? '';
  const pageId = child.id;
  const planBlocks = await listBlockChildrenAll(pageId);
  return { title, pageId, blocks: planBlocks as any[] };
}

/** Listado paginado de hijos de un bloque (`page_size`); usa el mismo `notionFetch` que el resto del cliente. */
export async function listNotionBlockChildrenPage(
  blockId: string,
  pageSize: number,
): Promise<any[]> {
  return listBlockChildrenPage(blockId, pageSize) as Promise<any[]>;
}

async function findInlineTableInPage(pageId: string): Promise<NotionTableBlock> {
  const blocks = await listBlockChildrenAll(pageId);
  const direct = blocks.find((b) => b.type === 'table') as NotionTableBlock | undefined;
  if (direct) return direct;

  // Sometimes tables are nested under wrappers (e.g. synced_block/toggle). We do a shallow BFS.
  const queue = [...blocks];
  const seen = new Set<string>();
  while (queue.length) {
    const b = queue.shift()!;
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    if (b.type === 'table') return b as NotionTableBlock;
    // Best-effort: try expanding children (many blocks have children; Notion doesn't expose has_children here reliably)
    try {
      const children = await listBlockChildrenAll(b.id);
      for (const c of children) queue.push(c);
    } catch {
      // ignore non-expandable blocks
    }
  }

  throw new Error('No inline table block found on phases page');
}

async function getPhaseRowForUser(pageId: string, user: ProfileId) {
  const table = await findInlineTableInPage(pageId);
  const rows = (await listBlockChildrenAll(table.id)).filter(
    (b) => b.type === 'table_row',
  ) as NotionTableRowBlock[];
  if (!rows.length) throw new Error('Inline table has no rows');

  const wanted = normalizePersonName(getNotionPhaseRowLabel(user));
  for (const row of rows) {
    const cells = row.table_row.cells;
    if (cells.length < 3) continue;
    const personaRaw = cellToText(cells[0]);
    const persona = normalizePersonName(personaRaw);
    if (persona === wanted) {
      return { row };
    }
  }

  throw new Error(`No row found for user "${user}" in inline table`);
}

export async function getCurrentPhase(
  user: ProfileId,
): Promise<{ phase: string; nextCycle: Date }> {
  const pageId = requireSetting('NOTION_PHASES_PAGE_ID', getNotionSettings().phasesPageId);
  const { row } = await getPhaseRowForUser(pageId, user);

  const cells = row.table_row.cells;
  const phaseText = cellToText(cells[1]).trim();
  const nextText = cellToText(cells[2]).trim();

  return {
    phase: phaseText,
    nextCycle: parseDateLoose(nextText),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tés (BD de Notion: té recomendado por fase del ciclo)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BD de Tés del maintainer: fallback cuando la config viene de `.env` y no
 * define una propia. Con settings de onboarding se usa solo `teasDbId`
 * detectado (otro token no puede leer esta BD).
 */
const DEFAULT_TEAS_DB_ID = '235d8880-2045-81af-93a9-c0b96040f14d';

function resolveTeasDbId(): string {
  const { teasDbId, apiKey } = getNotionSettings();
  if (teasDbId) return teasDbId;
  return apiKey && getNotionSettingsSource() === 'env' ? DEFAULT_TEAS_DB_ID : '';
}

/** Etiquetas de "Fase del ciclo recomendada" en la BD de Tés (emojis propios de esa BD). */
const TEA_PHASE_TO_LABELS: Record<Phase, string[]> = {
  menstrual: ['Menstruación 🩸'],
  folicular: ['Folicular 🏃🏻‍♀️'],
  ovulatoria: ['Ovulación 🍑'],
  lutea: ['Lútea 🧘🏻‍♀️', 'Premenstrual 😾'],
};

const TEA_IN_HOUSE_PROPS = ['¿Tengo en casa?', 'Tengo en casa?', 'Tengo en casa', '¿Tengo en casa'];
const TEA_PHASE_PROPS = [
  'Fase del ciclo recomendada',
  'Fase del ciclo',
  'Fase recomendada',
  'Fase',
];
const TEA_COMPROBABLE_PROPS = [
  'Beneficios comprobables',
  'Beneficios Comprobables',
  'Beneficios comprovables',
  'beneficios_comprobables',
];
const TEA_HOLISTIC_PROPS = [
  'Beneficios holísticos',
  'Beneficios Holísticos',
  'Beneficios holisticos',
  'beneficios_holisticos',
];

export async function getTeasForPhase(phase: Phase): Promise<Tea[]> {
  const teasDbId = resolveTeasDbId();
  if (!teasDbId) return [];
  const wantedLabels = TEA_PHASE_TO_LABELS[phase] ?? [];
  const pages = await queryDatabaseAll(teasDbId, {});

  return pages
    .filter((p) => {
      const inHouse = propCheckbox(p.properties, TEA_IN_HOUSE_PROPS, false);
      if (!inHouse) return false;
      const phaseLabels = propMultiSelect(p.properties, TEA_PHASE_PROPS);
      return phaseLabels.some((label) => wantedLabels.includes(label));
    })
    .map((p) => ({
      notion_id: p.id,
      name: propText(p.properties, ['Name', 'Nombre']).trim(),
      comprovable_benefits: propMultiSelect(p.properties, TEA_COMPROBABLE_PROPS),
      holistic_benefits: propMultiSelect(p.properties, TEA_HOLISTIC_PROPS),
    }));
}

export async function updatePhase(user: ProfileId, phase: string, nextCycle: Date): Promise<void> {
  const pageId = requireSetting('NOTION_PHASES_PAGE_ID', getNotionSettings().phasesPageId);
  const { row } = await getPhaseRowForUser(pageId, user);
  const prevPersona = cellToText(row.table_row.cells[0]).trim();
  const personaToWrite = prevPersona || getNotionPhaseRowLabel(user);

  const phaseLabel = phaseKeyToNotionLabel(phase);
  const cells: NotionCell[] = [
    textCell(personaToWrite),
    textCell(phaseLabel),
    textCell(toDeviceCalendarISODate(nextCycle)),
  ];

  await notionFetch(`/blocks/${encodeURIComponent(row.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      table_row: { cells },
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding: descubrimiento del template en el workspace de la usuaria
// ─────────────────────────────────────────────────────────────────────────────

interface NotionSearchResultItem {
  id: NotionId;
  object: 'database' | 'page';
  title?: NotionRichText[];
  properties?: Record<string, NotionPropertyValue>;
}

function searchItemTitle(item: NotionSearchResultItem): string {
  if (item.object === 'database') return richTextToPlainText(item.title).trim();
  const titleProp = Object.values(item.properties ?? {}).find((p) => p.type === 'title');
  return richTextToPlainText(titleProp?.title).trim();
}

/** Máximo de resultados de search a recorrer por tipo (workspaces grandes). */
const SEARCH_SCAN_CAP = 300;

async function searchAllByObject(object: 'database' | 'page'): Promise<NotionSearchItem[]> {
  const out: NotionSearchItem[] = [];
  let cursor: string | null | undefined = undefined;
  while (out.length < SEARCH_SCAN_CAP) {
    const resp: NotionListResponse<NotionSearchResultItem> = await notionFetch('/search', {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: 'object', value: object },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    for (const item of resp.results) {
      const title = searchItemTitle(item);
      if (title) out.push({ id: item.id, title });
    }
    if (!resp.has_more || !resp.next_cursor) break;
    cursor = resp.next_cursor;
  }
  return out;
}

/** Nombre del bot/workspace del token — feedback de "token válido" en onboarding. */
export async function getNotionTokenInfo(apiKey: string): Promise<{ name: string }> {
  return withNotionApiKey(apiKey, async () => {
    const me = await notionFetch<{ name?: string; bot?: { workspace_name?: string } }>('/users/me');
    return { name: me.bot?.workspace_name || me.name || 'Notion' };
  });
}

export interface NotionTemplateDiscovery {
  supplementsDbId: string;
  phasesPageId: string;
  mealPrepHubPageId: string;
  teasDbId: string;
  /** Personas de la tabla de fases (sin fila de header): para mapear perfiles. */
  phaseRowLabels: string[];
}

/** Filas persona de la tabla inline de una página de fases, o null si no la tiene. */
async function phaseRowLabelsForPage(pageId: string): Promise<string[] | null> {
  let table: NotionTableBlock;
  try {
    table = await findInlineTableInPage(pageId);
  } catch {
    return null;
  }
  const rows = (await listBlockChildrenAll(table.id)).filter(
    (b) => b.type === 'table_row',
  ) as NotionTableRowBlock[];
  const dataRows = table.table.has_column_header ? rows.slice(1) : rows;
  const labels = dataRows
    .filter((r) => r.table_row.cells.length >= 3)
    .map((r) => cellToText(r.table_row.cells[0]).trim())
    .filter(Boolean);
  return labels.length ? labels : null;
}

async function hubHasComidasActivas(pageId: string): Promise<boolean> {
  try {
    const blocks = await listBlockChildrenAll(pageId);
    return blocks.some((b) => b.type === 'heading_2' && heading2PlainText(b) === 'Comidas Activas');
  } catch {
    return false;
  }
}

/**
 * Busca en lo compartido con la integración las piezas del template (DB
 * Suplementos, página de Fases con tabla inline, hub de Comidas y BD de Tés
 * opcionales) y verifica su estructura. Lanza con mensaje accionable si falta
 * una pieza requerida.
 */
export async function discoverNotionTemplate(apiKey: string): Promise<NotionTemplateDiscovery> {
  return withNotionApiKey(apiKey, async () => {
    const [databases, pages] = [
      await searchAllByObject('database'),
      await searchAllByObject('page'),
    ];
    const matches = matchNotionTemplate(databases, pages);

    if (!matches.supplementsDbId) {
      throw new Error(
        'No encontré la base de datos de Suplementos. ¿Compartiste las páginas del template con tu integración?',
      );
    }

    let phasesPageId = '';
    let phaseRowLabels: string[] = [];
    for (const candidate of matches.phasesPageCandidates) {
      const labels = await phaseRowLabelsForPage(candidate.id);
      if (labels) {
        phasesPageId = candidate.id;
        phaseRowLabels = labels;
        break;
      }
    }
    if (!phasesPageId) {
      throw new Error(
        'No encontré la página de Fases con su tabla (persona / fase / próximo ciclo). Revisa que esté compartida con la integración.',
      );
    }

    let mealPrepHubPageId = '';
    for (const candidate of matches.mealPrepHubCandidates) {
      if (await hubHasComidasActivas(candidate.id)) {
        mealPrepHubPageId = candidate.id;
        break;
      }
    }

    return {
      supplementsDbId: matches.supplementsDbId,
      phasesPageId,
      mealPrepHubPageId,
      teasDbId: matches.teasDbId,
      phaseRowLabels,
    };
  });
}

/**
 * Valida IDs pegados a mano con el token dado: la DB de suplementos responde a
 * un query y la página de fases tiene la tabla inline. Devuelve las personas
 * encontradas (mismo contrato que el descubrimiento automático).
 */
export async function verifyManualNotionIds(
  apiKey: string,
  ids: { supplementsDbId: string; phasesPageId: string },
): Promise<{ phaseRowLabels: string[] }> {
  return withNotionApiKey(apiKey, async () => {
    await notionFetch(`/databases/${encodeURIComponent(ids.supplementsDbId)}/query`, {
      method: 'POST',
      body: JSON.stringify({ page_size: 1 }),
    });
    const labels = await phaseRowLabelsForPage(ids.phasesPageId);
    if (!labels) {
      throw new Error('La página de fases no tiene una tabla con persona / fase / próximo ciclo.');
    }
    return { phaseRowLabels: labels };
  });
}
