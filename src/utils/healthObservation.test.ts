import { formatDurationHM, formatQuantity, mergeIntervalsTotalMs } from './healthObservation';

const H = 60 * 60 * 1000;
const MIN = 60 * 1000;

describe('mergeIntervalsTotalMs', () => {
  it('suma intervalos disjuntos', () => {
    expect(
      mergeIntervalsTotalMs([
        { startMs: 0, endMs: 2 * H },
        { startMs: 3 * H, endMs: 4 * H },
      ]),
    ).toBe(3 * H);
  });

  it('fusiona solapes (dos fuentes reportando el mismo sueño)', () => {
    expect(
      mergeIntervalsTotalMs([
        { startMs: 0, endMs: 6 * H },
        { startMs: 1 * H, endMs: 7 * H },
      ]),
    ).toBe(7 * H);
  });

  it('ignora intervalos inválidos', () => {
    expect(
      mergeIntervalsTotalMs([
        { startMs: 5, endMs: 5 },
        { startMs: NaN, endMs: 10 },
        { startMs: 0, endMs: H },
      ]),
    ).toBe(H);
  });

  it('vacío → 0', () => {
    expect(mergeIntervalsTotalMs([])).toBe(0);
  });
});

describe('formatDurationHM', () => {
  it('horas y minutos', () => {
    expect(formatDurationHM(7 * H + 25 * MIN)).toBe('7 h 25 min');
    expect(formatDurationHM(8 * H)).toBe('8 h');
    expect(formatDurationHM(45 * MIN)).toBe('45 min');
  });
});

describe('formatQuantity', () => {
  it('redondea según la unidad y traduce etiquetas', () => {
    expect(formatQuantity(36.4567, 'degC')).toBe('36.46 °C');
    expect(formatQuantity(52.7, 'count/min')).toBe('53 rpm');
    expect(formatQuantity(48.2, 'ms')).toBe('48 ms');
    expect(formatQuantity(8412.9, 'count')).toBe('8413');
  });
});
