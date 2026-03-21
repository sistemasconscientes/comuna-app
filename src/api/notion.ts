import {
  NOTION_API_KEY,
  NOTION_MEAL_PREP_HUB_PAGE_ID,
  NOTION_SUPPLEMENTS_DB_ID,
  NOTION_PHASES_PAGE_ID,
} from '@env';
import type { Supplement, SupplementPersona } from '../types';
import { normalizePhase } from '../utils/phaseUtils';
import { supplementMatchesCurrentTemporada } from '../utils/temporadaFilter';

const BASE_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const API_KEY = NOTION_API_KEY ?? '';
const SUPPLEMENTS_DB_ID = NOTION_SUPPLEMENTS_DB_ID ?? '';
const PHASES_PAGE_ID = NOTION_PHASES_PAGE_ID ?? '';
const MEAL_PREP_HUB_PAGE_ID = NOTION_MEAL_PREP_HUB_PAGE_ID ?? '';

const baseHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type': 'application/json',
};

async function notionFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!API_KEY) throw new Error('Missing NOTION_API_KEY');
  const mergedHeaders: Record<string, string> = {
    ...baseHeaders,
    ...(options?.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: mergedHeaders });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion API error ${res.status}: ${body}`);
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

type NotionBlock = NotionTableBlock | NotionTableRowBlock | (NotionBlockBase & Record<string, unknown>);

interface NotionListResponse<T> {
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function requireEnv(name: string, value: string): string {
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

function parseSupplementPersona(raw: string): SupplementPersona {
  const t = raw.trim();
  if (t === 'Ambas' || t === 'Diana' || t === 'Estefanía') return t;
  return 'Diana';
}

function parseDateLoose(input: string): Date {
  const s = input.trim();
  // Prefer YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoMatch) return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00.000Z`);
  // Fallback DD/MM/YYYY
  const dmyMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (dmyMatch) return new Date(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}T00:00:00.000Z`);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: "${input}"`);
  return d;
}

function toISODate(date: Date): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid Date');
  return d.toISOString().slice(0, 10);
}

function pickProp(
  props: Record<string, NotionPropertyValue>,
  names: string[]
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

function propCheckbox(props: Record<string, NotionPropertyValue>, names: string[], fallback: boolean): boolean {
  const prop = pickProp(props, names);
  if (!prop) return fallback;
  if (prop.type === 'checkbox') return prop.checkbox ?? fallback;
  return fallback;
}

/** Etiquetas de Temporada: misma prioridad que `seasonRaw` (texto si existe; si no, multi-select). */
function temporadaLabelsFromProps(props: Record<string, NotionPropertyValue>): string[] {
  const text = propText(props, ['Temporada', 'Season']).trim();
  if (text) return text.split(',').map((s) => s.trim()).filter(Boolean);
  return propMultiSelect(props, ['Temporada', 'Season'])
    .map((s) => s.trim())
    .filter(Boolean);
}

async function queryDatabaseAll(databaseId: string, body: Record<string, unknown>) {
  const results: NotionDatabaseQueryResponse['results'] = [];
  let cursor: string | null | undefined = undefined;
  while (true) {
    const page: NotionDatabaseQueryResponse = await notionFetch(
      `/databases/${databaseId}/query`,
      {
      method: 'POST',
      body: JSON.stringify({ ...body, ...(cursor ? { start_cursor: cursor } : {}) }),
      }
    );
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
      `/blocks/${blockId}/children${cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : ''}`
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
    `/blocks/${encodeURIComponent(blockId)}/children?${q.toString()}`
  );
  return resp.results;
}

function heading2PlainText(block: NotionBlock): string {
  if (block.type !== 'heading_2') return '';
  const rich = (block as { heading_2?: { rich_text?: NotionRichText[] } }).heading_2?.rich_text;
  return richTextToPlainText(rich).trim();
}

function richText(content: string): NotionRichText[] {
  return content ? [{ type: 'text', text: { content }, plain_text: content }] : [];
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
  user: 'diana' | 'estefania',
  currentPhase: string,
  applyTemporadaFilter = true,
): Promise<Supplement[]> {
  const dbId = requireEnv('NOTION_SUPPLEMENTS_DB_ID', SUPPLEMENTS_DB_ID);

  const PERSONA_VALUES: Record<'diana' | 'estefania', string> = {
    diana: 'Diana',
    estefania: 'Estefanía',
  };
  const personaValue = PERSONA_VALUES[user];

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
        supplementMatchesCurrentTemporada(temporadaLabelsFromProps(p.properties), month, currentPhase),
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
  const hubId = MEAL_PREP_HUB_PAGE_ID.trim();
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
export async function listNotionBlockChildrenPage(blockId: string, pageSize: number): Promise<any[]> {
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

async function getPhaseRowForUser(pageId: string, user: 'diana' | 'estefania') {
  const table = await findInlineTableInPage(pageId);
  const rows = (await listBlockChildrenAll(table.id)).filter((b) => b.type === 'table_row') as NotionTableRowBlock[];
  if (!rows.length) throw new Error('Inline table has no rows');

  const wanted = normalizePersonName(user);
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
  user: 'diana' | 'estefania'
): Promise<{ phase: string; nextCycle: Date }> {
  const pageId = requireEnv('NOTION_PHASES_PAGE_ID', PHASES_PAGE_ID);
  const { row } = await getPhaseRowForUser(pageId, user);

  const cells = row.table_row.cells;
  const phaseText = cellToText(cells[1]).trim();
  const nextText = cellToText(cells[2]).trim();

  return {
    phase: phaseText,
    nextCycle: parseDateLoose(nextText),
  };
}

export async function updatePhase(
  user: 'diana' | 'estefania',
  phase: string,
  nextCycle: Date
): Promise<void> {
  const pageId = requireEnv('NOTION_PHASES_PAGE_ID', PHASES_PAGE_ID);
  const { row } = await getPhaseRowForUser(pageId, user);
  const prevPersona = cellToText(row.table_row.cells[0]).trim();
  const personaToWrite = prevPersona || user;

  const phaseLabel = phaseKeyToNotionLabel(phase);
  const cells: NotionCell[] = [
    textCell(personaToWrite),
    textCell(phaseLabel),
    textCell(toISODate(nextCycle)),
  ];

  await notionFetch(`/blocks/${encodeURIComponent(row.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      table_row: { cells },
    }),
  });
}
