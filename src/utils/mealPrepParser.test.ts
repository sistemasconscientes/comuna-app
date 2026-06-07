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

function row3(c0: string, c1: string, c2: string): NotionBlock {
  return {
    id: `row3-${c0}`,
    type: 'table_row',
    table_row: { cells: [rt(c0), rt(c1), rt(c2)] },
  };
}

function h2(text: string): NotionBlock {
  return { id: `h2-${text}`, type: 'heading_2', heading_2: { rich_text: rt(text) } };
}

function h1(text: string): NotionBlock {
  return { id: `h1-${text}`, type: 'heading_1', heading_1: { rich_text: rt(text) } };
}

describe('getTodayMeals', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns meals for matching weekday heading and table rows', () => {
    jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1); // Lunes

    const blocks: NotionBlock[] = [
      h2('📅 Plan semanal'),
      { id: 'h', type: 'heading_3', heading_3: { rich_text: rt('Lunes 23 mar — Lútea 🦥') } },
      {
        id: 't',
        type: 'table',
        table: { table_width: 2, has_column_header: true, has_row_header: false },
      },
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
    jest.spyOn(Date.prototype, 'getDay').mockReturnValue(3); // Miércoles
    const blocks: NotionBlock[] = [
      h2('📅 Plan semanal'),
      { id: 'h', type: 'heading_3', heading_3: { rich_text: rt('Lunes 23 mar') } },
    ];
    expect(getTodayMeals(blocks)).toBeNull();
  });

  it('returns null si no hay ancla Plan semanal aunque coincida el día', () => {
    jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1);
    const blocks: NotionBlock[] = [
      { id: 'h', type: 'heading_3', heading_3: { rich_text: rt('Lunes 23 mar') } },
      { id: 't', type: 'table', table: {} },
      row('Comida', 'Plato'),
      row('Desayuno', 'Avena'),
    ];
    expect(getTodayMeals(blocks)).toBeNull();
  });

  it('treats first row as data when first column is not Comida/Tipo', () => {
    jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1);
    const blocks: NotionBlock[] = [
      h2('📅 Plan semanal'),
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
    jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1);
    const blocks: NotionBlock[] = [
      h2('📅 Plan semanal'),
      { id: 'h', type: 'heading_3', heading_3: { rich_text: rt('Lunes 23 mar') } },
      { id: 't', type: 'table', table: {} },
      row('Tipo', 'Plato'),
      row('Cena', 'Sopa'),
    ];
    const out = getTodayMeals(blocks);
    expect(out!.meals).toEqual([{ tipo: 'Cena', plato: 'Sopa' }]);
  });

  it('ignores día en Chef Prep antes de 📅 Plan semanal', () => {
    jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1);
    const blocks: NotionBlock[] = [
      h2('Chef Prep'),
      { id: 'chef-lun', type: 'heading_3', heading_3: { rich_text: rt('Lunes — prep') } },
      { id: 't0', type: 'table', table: {} },
      row('Comida', 'NO'),
      h2('📅 Plan semanal'),
      { id: 'h', type: 'heading_3', heading_3: { rich_text: rt('Lunes 23 mar') } },
      { id: 't', type: 'table', table: {} },
      row('Comida', 'Plato'),
      row('Desayuno', 'Avena'),
    ];
    const out = getTodayMeals(blocks);
    expect(out!.dayLabel).toBe('Lunes 23 mar');
    expect(out!.meals).toEqual([{ tipo: 'Desayuno', plato: 'Avena' }]);
  });

  it('con ancla Plan semanal, null si el día solo aparece antes del plan', () => {
    jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1);
    const blocks: NotionBlock[] = [
      { id: 'chef-lun', type: 'heading_3', heading_3: { rich_text: rt('Lunes — chef') } },
      { id: 't0', type: 'table', table: {} },
      row('Comida', 'X'),
      h2('📅 Plan semanal'),
      { id: 'mar', type: 'heading_3', heading_3: { rich_text: rt('Martes 24 mar') } },
    ];
    expect(getTodayMeals(blocks)).toBeNull();
  });

  it('acepta ancla Plan semanal en heading_1', () => {
    jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1);
    const blocks: NotionBlock[] = [
      h1('📅 Plan semanal'),
      { id: 'h', type: 'heading_3', heading_3: { rich_text: rt('Lunes 23 mar') } },
      { id: 't', type: 'table', table: {} },
      row('Comida', 'Plato'),
      row('Desayuno', 'Avena'),
    ];
    expect(getTodayMeals(blocks)!.meals).toEqual([{ tipo: 'Desayuno', plato: 'Avena' }]);
  });

  it('ignora heading_3 de Chef Prep que contiene el día (ej. viernes) antes del plan', () => {
    jest.spyOn(Date.prototype, 'getDay').mockReturnValue(5); // Viernes
    const blocks: NotionBlock[] = [
      {
        id: 'chef-vie',
        type: 'heading_3',
        heading_3: { rich_text: rt('Prep del viernes pasado') },
      },
      { id: 't0', type: 'table', table: {} },
      row('Comida', 'MAL'),
      h2('📅 Plan semanal'),
      { id: 'h', type: 'heading_3', heading_3: { rich_text: rt('Viernes 27 mar') } },
      { id: 't', type: 'table', table: {} },
      row('Comida', 'Plato'),
      row('Desayuno', 'Correcto'),
    ];
    const out = getTodayMeals(blocks);
    expect(out!.dayLabel).toBe('Viernes 27 mar');
    expect(out!.meals).toEqual([{ tipo: 'Desayuno', plato: 'Correcto' }]);
  });

  it('tabla 3 columnas: plato según usuaria', () => {
    jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1);
    const blocks: NotionBlock[] = [
      h2('📅 Plan semanal'),
      { id: 'h', type: 'heading_3', heading_3: { rich_text: rt('Lunes 23 mar') } },
      { id: 't', type: 'table', table: { table_width: 3 } },
      row3('Comida', 'Diana 🩸', 'Estefanía 🌸'),
      row3('Desayuno', 'Avena D', 'Avena E'),
    ];
    expect(getTodayMeals(blocks, 'profile_1')!.meals).toEqual([
      { tipo: 'Desayuno', plato: 'Avena D' },
    ]);
    expect(getTodayMeals(blocks, 'profile_2')!.meals).toEqual([
      { tipo: 'Desayuno', plato: 'Avena E' },
    ]);
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
