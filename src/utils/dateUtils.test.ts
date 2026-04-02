import { getLocalTodayISO } from './dateUtils';

describe('getLocalTodayISO', () => {
  it('devuelve YYYY-MM-DD en calendario local', () => {
    const fixed = new Date(2026, 3, 1, 15, 30, 0); // 1 abr 2026 local
    expect(getLocalTodayISO(fixed)).toBe('2026-04-01');
  });

  it('usa componentes locales del Date (no el día UTC)', () => {
    const localMar31 = new Date(2026, 2, 31, 20, 0, 0);
    expect(getLocalTodayISO(localMar31)).toBe('2026-03-31');
  });
});
