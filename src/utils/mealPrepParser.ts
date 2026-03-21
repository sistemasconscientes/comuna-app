/**
 * Parsing de bloques Notion del plan meal prep (heading_3 por día + tabla Comida/Plato).
 * `getMealPrep()` devuelve solo hijos directos de la página del plan; las filas bajo cada `table`
 * no vienen incluidas — usar `expandMealPrepNotionBlocks` + cliente Notion antes de `getTodayMeals`.
 */

export interface NotionRichText {
  plain_text?: string;
  type?: string;
  text?: { content: string };
}

export type NotionBlock = {
  id: string;
  type: string;
  heading_2?: { rich_text?: NotionRichText[] };
  heading_3?: { rich_text?: NotionRichText[] };
  table?: { table_width?: number; has_column_header?: boolean; has_row_header?: boolean };
  table_row?: { cells: NotionRichText[][] };
};

const SPANISH_WEEKDAY: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function richTextToPlain(rich: NotionRichText[] | undefined): string {
  return (rich ?? []).map((r) => r.plain_text ?? r.text?.content ?? '').join('');
}

function headingPlainText(block: NotionBlock): string {
  if (block.type === 'heading_3') {
    return richTextToPlain(block.heading_3?.rich_text).trim();
  }
  if (block.type === 'heading_2') {
    return richTextToPlain(block.heading_2?.rich_text).trim();
  }
  return '';
}

function cellToText(cell: NotionRichText[] | undefined): string {
  return richTextToPlain(cell).trim();
}

/** Prioriza el primer segmento (p. ej. `cells[0][0].plain_text`) y concatena el resto si hay varios. */
function mealColumnText(cells: NotionRichText[][] | undefined, colIndex: number): string {
  const cell = cells?.[colIndex];
  if (!cell?.length) return '';
  const first = cell[0];
  const head = (first?.plain_text ?? first?.text?.content ?? '').trim();
  if (cell.length === 1) return head;
  const tail = richTextToPlain(cell.slice(1)).trim();
  return tail ? `${head} ${tail}`.trim() : head;
}

function isMealTableHeaderRow(row: NotionBlock): boolean {
  const cells = row.table_row?.cells;
  if (!cells?.length) return false;
  const col0 = normalizeKey(mealColumnText(cells, 0));
  return col0 === 'comida' || col0 === 'tipo';
}

/**
 * Inserta tras cada `table` sus hijos `table_row` (Notion no los devuelve en el listado de la página).
 */
export async function expandMealPrepNotionBlocks(
  blocks: NotionBlock[],
  listChildren: (blockId: string, pageSize: number) => Promise<any[]>,
  tableChildPageSize = 100,
): Promise<NotionBlock[]> {
  const out: NotionBlock[] = [];
  for (const b of blocks) {
    out.push(b);
    if (b.type === 'table') {
      const rows = await listChildren(b.id, tableChildPageSize);
      for (const row of rows) {
        out.push(row as NotionBlock);
      }
    }
  }
  return out;
}

export function getTodayMeals(blocks: NotionBlock[]): {
  dayLabel: string;
  meals: { tipo: string; plato: string }[];
} | null {
  const dow = new Date().getDay();
  const dayName = SPANISH_WEEKDAY[dow];
  const dayKey = normalizeKey(dayName);

  let headingIndex = -1;
  let dayLabel = '';

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type !== 'heading_3') continue;
    const text = headingPlainText(b);
    if (!text) continue;
    if (normalizeKey(text).includes(dayKey)) {
      headingIndex = i;
      dayLabel = text;
      break;
    }
  }

  if (headingIndex === -1) return null;

  const section: NotionBlock[] = [];
  for (let j = headingIndex + 1; j < blocks.length; j++) {
    const b = blocks[j];
    if (b.type === 'heading_3' || b.type === 'heading_2') break;
    section.push(b);
  }

  const tableIdx = section.findIndex((b) => b.type === 'table');
  if (tableIdx === -1) return null;

  const rows: NotionBlock[] = [];
  for (let k = tableIdx + 1; k < section.length; k++) {
    const b = section[k];
    if (b.type !== 'table_row') break;
    rows.push(b);
  }

  if (rows.length === 0) return null;

  let dataRows = rows;
  if (isMealTableHeaderRow(rows[0])) {
    dataRows = rows.slice(1);
  }
  if (dataRows.length === 0) return null;

  const meals: { tipo: string; plato: string }[] = [];

  for (const row of dataRows) {
    const cells = row.table_row?.cells;
    if (!cells || cells.length < 2) continue;
    meals.push({
      tipo: mealColumnText(cells, 0),
      plato: mealColumnText(cells, 1),
    });
  }

  if (!meals.length) return null;

  return { dayLabel, meals };
}
