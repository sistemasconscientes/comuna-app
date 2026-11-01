import {
  choreStatusForDay,
  everyNFromText,
  nextDueISO,
  parseFrequency,
  parseWeekdays,
} from './choreSchedule';

const base = { frequency: 'semanal' as const, everyNDays: null, weekdays: [], lastDone: null };

describe('parseFrequency / parseWeekdays', () => {
  it('reconoce las opciones del select en español e inglés', () => {
    expect(
      [
        'Diaria',
        'Semanal',
        'Cada 2 semanas',
        'Quincenal',
        'Mensual',
        'Cada 3 días',
        'Weekly',
        '?',
      ].map(parseFrequency),
    ).toEqual([
      'diaria',
      'semanal',
      'quincenal',
      'quincenal',
      'mensual',
      'cada_n_dias',
      'semanal',
      null,
    ]);
    expect(everyNFromText('Cada 3 días')).toBe(3);
  });

  it('días de la semana con o sin acento y abreviados', () => {
    expect(parseWeekdays(['Lun', 'Miércoles', 'sáb.', 'Dom', 'x'])).toEqual([0, 1, 3, 6]);
  });
});

describe('choreStatusForDay', () => {
  // 2026-11-02 es lunes
  it('con días fijos toca solo esos días', () => {
    const c = { ...base, weekdays: [1, 4] };
    expect(choreStatusForDay(c, '2026-11-02').visible).toBe(true);
    expect(choreStatusForDay(c, '2026-11-03').visible).toBe(false);
  });

  it('por intervalo: nunca hecha toca; dentro del intervalo no; atrasada cuenta días', () => {
    expect(choreStatusForDay(base, '2026-11-02')).toEqual({
      visible: true,
      doneToday: false,
      overdueDays: 0,
    });
    expect(choreStatusForDay({ ...base, lastDone: '2026-10-30' }, '2026-11-02').visible).toBe(
      false,
    );
    expect(choreStatusForDay({ ...base, lastDone: '2026-10-26' }, '2026-11-02')).toEqual({
      visible: true,
      doneToday: false,
      overdueDays: 0,
    });
    expect(choreStatusForDay({ ...base, lastDone: '2026-10-20' }, '2026-11-02').overdueDays).toBe(
      6,
    );
  });

  it('hecha hoy se muestra marcada (también si era de días fijos)', () => {
    const s = choreStatusForDay({ ...base, weekdays: [3], lastDone: '2026-11-02' }, '2026-11-02');
    expect(s).toEqual({ visible: true, doneToday: true, overdueDays: 0 });
  });

  it('cada N días y diaria', () => {
    const c = { ...base, frequency: 'cada_n_dias' as const, everyNDays: 3, lastDone: '2026-10-31' };
    expect(choreStatusForDay(c, '2026-11-02').visible).toBe(false);
    expect(choreStatusForDay(c, '2026-11-03').visible).toBe(true);
    const daily = { ...base, frequency: 'diaria' as const, lastDone: '2026-11-01' };
    expect(choreStatusForDay(daily, '2026-11-02').visible).toBe(true);
  });

  it('nextDueISO cruza meses', () => {
    expect(nextDueISO({ ...base, frequency: 'mensual', lastDone: '2026-10-15' })).toBe(
      '2026-11-14',
    );
    expect(nextDueISO({ ...base, weekdays: [1], lastDone: '2026-10-15' })).toBeNull();
  });
});
