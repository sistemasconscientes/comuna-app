import { expandMealPrepNotionBlocks, getTodayMeals, type NotionBlock } from './mealPrepParser';

function rt(text: string) {
  return [{ type: 'text', plain_text: text, text: { content: text } }];
}

function row(c0: string, c1: string): NotionBlock {
  return {
    id: `row-${c0}`,
    type: 'table_row',
    table_row: { cells: [rt(c0), rt(c1)] },
  };
}

describe('getTodayMeals', () => {
  const realGetDay = Date.prototype.getDay;

  afterEach(() => {
    Date.prototype.getDay = realGetDay;
  });

  it('returns meals for matching weekday heading and table rows', () => {
    Date.prototype.getDay = () => 1; // Lunes

    const blocks: NotionBlock[] = [
      { id: 'h', type: 'heading_3', heading_3: { rich_text: rt('Lunes 23 mar — Lútea 🦥') } },
      { id: 't', type: 'table', table: { table_width: 2, has_column_header: true, has_row_header: false } },
      row('Comida', 'Plato'),
      row('Desayuno', 'Avena'),
      row('Comida', 'Pollo'),
      { id: 'h2', type: 'heading_3', heading_3: { rich_text: rt('Martes 24 mar') } },
    ];

    const out = getTodayMeals(blocks);
    expect(out).not.toBeNull();
    expect(out!.dayLabel).toBe('Lunes 23 mar — Lútea 🦥');
    expect(out!.meals).toEqual([
      { tipo: 'Desayuno', plato: 'Avena' },
      { tipo: 'Comida', plato: 'Pollo' },
    ]);
  });

  it('returns null when no heading for today', () => {
    Date.prototype.getDay = () => 3; // Miércoles
    const blocks: NotionBlock[] = [
      { id: 'h', type: 'heading_3', heading_3: { rich_text: rt('Lunes 23 mar') } },
    ];
    expect(getTodayMeals(blocks)).toBeNull();
  });

  it('treats first row as data when first column is not Comida/Tipo', () => {
    Date.prototype.getDay = () => 1;
    const blocks: NotionBlock[] = [
      { id: 'h', type: 'heading_3', heading_3: { rich_text: rt('Lunes 23 mar') } },
      { id: 't', type: 'table', table: {} },
      row('🍳 Desayuno', 'Avena'),
      row('Comida', 'Pollo'),
    ];
    const out = getTodayMeals(blocks);
    expect(out!.meals).toEqual([
      { tipo: '🍳 Desayuno', plato: 'Avena' },
      { tipo: 'Comida', plato: 'Pollo' },
    ]);
  });

  it('skips header row when first column is Tipo', () => {
    Date.prototype.getDay = () => 1;
    const blocks: NotionBlock[] = [
      { id: 'h', type: 'heading_3', heading_3: { rich_text: rt('Lunes 23 mar') } },
      { id: 't', type: 'table', table: {} },
      row('Tipo', 'Plato'),
      row('Cena', 'Sopa'),
    ];
    const out = getTodayMeals(blocks);
    expect(out!.meals).toEqual([{ tipo: 'Cena', plato: 'Sopa' }]);
  });
});

describe('expandMealPrepNotionBlocks', () => {
  it('appends fetched rows after each table', async () => {
    const blocks: NotionBlock[] = [
      { id: 't1', type: 'table', table: {} },
      { id: 'p', type: 'paragraph' },
    ];
    const fetcher = jest.fn(async (id: string) => {
      if (id === 't1') return [row('Comida', 'Plato'), row('Cena', 'Sopa')];
      return [];
    });
    const out = await expandMealPrepNotionBlocks(blocks, fetcher);
    expect(fetcher).toHaveBeenCalledWith('t1', 100);
    expect(out.map((b) => b.type)).toEqual(['table', 'table_row', 'table_row', 'paragraph']);
  });
});
