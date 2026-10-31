/**
 * Tests de la robustez de red de Notion: `fetchWithRetry` (backoff, rate-limit,
 * no-retry en 4xx) y los helpers puros. No depende de `@env` (el loop está
 * aislado de las credenciales).
 */
import {
  fetchWithRetry,
  isRetryableStatus,
  parseRetryAfterMs,
  backoffMs,
  NotionApiError,
  isPhaseHeaderRow,
  isNoCyclePhaseText,
  parseNotionSupplementStock,
} from './notion';

const FAST = { retries: 3, baseDelayMs: 0 };

function res(status: number, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as unknown as Response;
}

describe('helpers de retry', () => {
  it('isRetryableStatus: 5xx y 429 sí; 4xx (salvo 429) no', () => {
    expect([500, 503, 429].map(isRetryableStatus)).toEqual([true, true, true]);
    expect([400, 401, 404].map(isRetryableStatus)).toEqual([false, false, false]);
  });

  it('parseRetryAfterMs: segundos, fecha HTTP, vacío y basura', () => {
    expect(parseRetryAfterMs('2')).toBe(2000);
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs('basura')).toBeNull();
    const now = 1_000_000;
    expect(parseRetryAfterMs(new Date(now + 3000).toUTCString(), now)).toBe(3000);
  });

  it('backoffMs: exponencial con jitter, acotado a 10s', () => {
    expect(backoffMs(0, 400, 0)).toBe(400);
    expect(backoffMs(1, 400, 0)).toBe(800);
    expect(backoffMs(2, 400, 1)).toBe(2400); // 1600 + 800 jitter
    expect(backoffMs(20, 400, 1)).toBe(10_000); // acotado
  });

  it('NotionApiError lleva status y mensaje con extracto', () => {
    const e = new NotionApiError(404, 'not found');
    expect(e.status).toBe(404);
    expect(e.message).toContain('404');
    expect(e.message).toContain('not found');
  });
});

describe('fetchWithRetry', () => {
  it('reintenta en 5xx y devuelve la respuesta al recuperarse', async () => {
    const doFetch = jest
      .fn<Promise<Response>, []>()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200));
    const out = await fetchWithRetry(doFetch, FAST);
    expect(out.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(2);
  });

  it('NO reintenta en 4xx: devuelve la respuesta de inmediato', async () => {
    const doFetch = jest.fn<Promise<Response>, []>().mockResolvedValue(res(400));
    const out = await fetchWithRetry(doFetch, FAST);
    expect(out.status).toBe(400);
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it('reintenta ante error de red y luego resuelve', async () => {
    const doFetch = jest
      .fn<Promise<Response>, []>()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce(res(200));
    const out = await fetchWithRetry(doFetch, FAST);
    expect(out.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(2);
  });

  it('agota reintentos en 429 persistente (1 intento + 3 reintentos)', async () => {
    const doFetch = jest
      .fn<Promise<Response>, []>()
      .mockResolvedValue(res(429, { 'retry-after': '0' }));
    const out = await fetchWithRetry(doFetch, FAST);
    expect(out.status).toBe(429);
    expect(doFetch).toHaveBeenCalledTimes(4);
  });

  it('propaga el error de red si nunca se recupera', async () => {
    const doFetch = jest.fn<Promise<Response>, []>().mockRejectedValue(new Error('offline'));
    await expect(fetchWithRetry(doFetch, FAST)).rejects.toThrow('offline');
    expect(doFetch).toHaveBeenCalledTimes(4);
  });
});

describe('isPhaseHeaderRow', () => {
  it('detecta encabezados escritos como fila normal', () => {
    expect(isPhaseHeaderRow(['Persona', 'Fase', 'Próximo ciclo'])).toBe(true);
    expect(isPhaseHeaderRow(['Nombre', 'Fase actual', 'Siguiente ciclo'])).toBe(true);
  });

  it('no descarta filas de datos reales', () => {
    expect(isPhaseHeaderRow(['Diana', 'Folicular 🌸', '2026-08-02'])).toBe(false);
    expect(isPhaseHeaderRow(['Estefanía', 'Lútea 🦥', '05/08/2026'])).toBe(false);
  });

  it('tolera celdas faltantes', () => {
    expect(isPhaseHeaderRow([''])).toBe(false);
  });
});

describe('isNoCyclePhaseText', () => {
  it('reconoce marcas de «sin ciclo» en la columna Fase (acentos, emoji, mayúsculas)', () => {
    expect(
      ['Sin ciclo', 'sin ciclo ⚪', 'No aplica', 'N/A', 'No menstrúa'].map(isNoCyclePhaseText),
    ).toEqual([true, true, true, true, true]);
  });

  it('las fases reales no cuentan como sin ciclo', () => {
    expect(['Folicular 🌸', 'Lútea 🦥', '', 'Menstrual'].map(isNoCyclePhaseText)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('parseNotionSupplementStock (stock compartido sin servidor)', () => {
  it('lee las propiedades de stock del template', () => {
    const s = parseNotionSupplementStock(
      {
        'Frasco abierto': { type: 'date', date: { start: '2026-10-01' } },
        'Pastillas por frasco': { type: 'number', number: 60 },
        'Pastillas al día': { type: 'number', number: 2 },
        'Recompra?': { type: 'checkbox', checkbox: true },
      },
      '2026-10-20T10:00:00.000Z',
    );
    expect(s).toMatchObject({ totalPills: 60, pillsPerDay: 2, restockFlagged: true });
    expect(s?.bottleOpenedAt?.getDate()).toBe(1);
  });

  it('sin conteo aún (o sin las propiedades) devuelve null', () => {
    expect(parseNotionSupplementStock({})).toBeNull();
    expect(
      parseNotionSupplementStock({ 'Pastillas por frasco': { type: 'number', number: null } }),
    ).toBeNull();
  });
});
