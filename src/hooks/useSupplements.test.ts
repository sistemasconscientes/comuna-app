/**
 * Tests de `syncSupplementsFromNotion`: el sync Notion→SQLite es lógica de "dinero"
 * (si falla en silencio, Stock queda con suplementos sin id local). Mockeamos la
 * capa de datos (`../db`, Notion API, Sentry) para aislar la lógica del hook.
 */

// `../db` abre SQLite al importarse; lo mockeamos por completo con un query builder falso.
// jest hoistea jest.mock(): solo puede referenciar variables con prefijo `mock`.
import { syncSupplementsFromNotion } from './useSupplements';
import { getSupplements } from '../api/notion';
import { reportErrorToSentry } from '../utils/observability';
import type { Supplement } from '../types';

type InsertRow = { notionId: string };
const mockSelect = jest.fn();
const mockInsertValues = jest.fn((_rows: InsertRow[]) => Promise.resolve());
const mockInsert = jest.fn(() => ({ values: mockInsertValues }));

jest.mock('../db', () => ({
  db: {
    // Las escrituras van en transacción; el mock ejecuta el callback con un `tx` falso.
    transaction: (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        select: () => ({ from: () => ({ where: mockSelect }) }),
        insert: () => mockInsert(),
      }),
  },
  supplements: { notionId: 'notionId' },
}));

jest.mock('../api/notion', () => ({ getSupplements: jest.fn() }));
jest.mock('../api/sharedStock', () => ({ getSharedStock: jest.fn() }));
jest.mock('../utils/observability', () => ({ reportErrorToSentry: jest.fn() }));

const mockGetSupplements = getSupplements as jest.MockedFunction<typeof getSupplements>;
const mockReport = reportErrorToSentry as jest.MockedFunction<typeof reportErrorToSentry>;

function supp(notion_id: string, name: string): Supplement {
  return {
    notion_id,
    name,
    category: [],
    dose: '1 cap',
    phase_specific: 'all',
    temporadaLabels: [],
    persona: 'Diana',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInsertValues.mockResolvedValue(undefined);
});

describe('syncSupplementsFromNotion', () => {
  it('devuelve mapping notion_id → id local y solo inserta los nuevos', async () => {
    mockGetSupplements.mockResolvedValue([supp('n1', 'Magnesio'), supp('n2', 'Omega 3')]);
    // 1ª query: existentes (n1 ya está). 2ª query: todas las filas tras insertar.
    mockSelect.mockResolvedValueOnce([{ notionId: 'n1', id: 10 }]).mockResolvedValueOnce([
      { notionId: 'n1', id: 10 },
      { notionId: 'n2', id: 11 },
    ]);

    const result = await syncSupplementsFromNotion('profile_1', 'menstrual', false);

    expect(result.idByNotionId).toEqual({ n1: 10, n2: 11 });
    expect(result.syncError).toBeNull();
    // Solo n2 debía insertarse (n1 ya existía).
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    const inserted = mockInsertValues.mock.calls[0][0];
    expect(inserted.map((r) => r.notionId)).toEqual(['n2']);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('no toca la DB ni inserta cuando Notion no devuelve suplementos', async () => {
    mockGetSupplements.mockResolvedValue([]);

    const result = await syncSupplementsFromNotion('profile_1', 'menstrual', false);

    expect(result.idByNotionId).toEqual({});
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('si el sync local falla: reporta a Sentry, no lanza, mapping vacío y syncError poblado', async () => {
    mockGetSupplements.mockResolvedValue([supp('n1', 'Magnesio')]);
    mockSelect.mockRejectedValueOnce(new Error('SQLite locked'));

    const result = await syncSupplementsFromNotion('profile_1', 'menstrual', false);

    // Los suplementos de Notion sí se devuelven (la UI no se queda vacía)...
    expect(result.supplements).toHaveLength(1);
    // ...pero el mapping queda vacío y el fallo se reporta + se expone en syncError.
    expect(result.idByNotionId).toEqual({});
    expect(result.syncError).toBeInstanceOf(Error);
    expect(result.syncError?.message).toBe('SQLite locked');
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport.mock.calls[0][1]).toMatchObject({ domain: 'sqlite', user: 'profile_1' });
  });

  it('propaga el error si Notion mismo falla (no es el sync local)', async () => {
    mockGetSupplements.mockRejectedValue(new Error('Notion 500'));

    await expect(syncSupplementsFromNotion('profile_1', 'menstrual', false)).rejects.toThrow(
      'Notion 500',
    );
  });
});
