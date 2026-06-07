import { calcDaysRemaining } from './stockCalc';

const DAY = 1000 * 60 * 60 * 24;
// "Ahora" fijo para tests deterministas.
const NOW = Date.parse('2026-01-31T12:00:00.000Z');
const opened = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

describe('calcDaysRemaining', () => {
  it('devuelve null si faltan datos', () => {
    expect(calcDaysRemaining({}, NOW)).toEqual({ daysRemaining: null, pillsRemaining: null });
    expect(calcDaysRemaining({ bottleOpenedAt: opened(1), totalPills: 30 }, NOW)).toEqual({
      daysRemaining: null,
      pillsRemaining: null,
    });
  });

  it('devuelve null si pillsPerDay no es positivo (evita división inválida)', () => {
    expect(
      calcDaysRemaining({ bottleOpenedAt: opened(1), totalPills: 30, pillsPerDay: 0 }, NOW),
    ).toEqual({ daysRemaining: null, pillsRemaining: null });
  });

  it('devuelve null ante fecha inválida', () => {
    expect(
      calcDaysRemaining({ bottleOpenedAt: 'no-es-fecha', totalPills: 30, pillsPerDay: 1 }, NOW),
    ).toEqual({ daysRemaining: null, pillsRemaining: null });
  });

  it('calcula días/pastillas restantes en el caso normal', () => {
    // 30 pastillas, 1/día, abierto hace 10 días → 20 restantes, 20 días.
    expect(
      calcDaysRemaining({ bottleOpenedAt: opened(10), totalPills: 30, pillsPerDay: 1 }, NOW),
    ).toEqual({ daysRemaining: 20, pillsRemaining: 20 });
  });

  it('CLAMPA a 0 cuando el frasco ya se agotó (nunca negativo)', () => {
    // 30 pastillas, 2/día, abierto hace 40 días → -50 sin clamp; debe ser 0.
    expect(
      calcDaysRemaining({ bottleOpenedAt: opened(40), totalPills: 30, pillsPerDay: 2 }, NOW),
    ).toEqual({ daysRemaining: 0, pillsRemaining: 0 });
  });

  it('fecha de apertura futura → 0 días transcurridos (frasco lleno, no negativo)', () => {
    expect(
      calcDaysRemaining({ bottleOpenedAt: opened(-5), totalPills: 30, pillsPerDay: 1 }, NOW),
    ).toEqual({ daysRemaining: 30, pillsRemaining: 30 });
  });
});
