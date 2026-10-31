import { currentMoment, doseMoment, groupByMoment } from './doseMoment';

describe('doseMoment', () => {
  it('reconoce momentos en español e inglés, con acentos', () => {
    expect(doseMoment('200 mg por la noche')).toBe('noche');
    expect(doseMoment('15 mg en ayunas')).toBe('manana');
    expect(doseMoment('2000 UI al desayuno')).toBe('manana');
    expect(doseMoment('1 g con la comida')).toBe('mediodia');
    expect(doseMoment('300 mg por la tarde')).toBe('mediodia');
    expect(doseMoment('1 cápsula antes de dormir')).toBe('noche');
    expect(doseMoment('1 cdta en licuado')).toBe('libre');
    expect(doseMoment('Mañana y noche')).toBe('noche');
  });

  it('agrupa en orden mañana → mediodía → noche → libre sin grupos vacíos', () => {
    const groups = groupByMoment([
      { dose: 'por la noche', id: 1 },
      { dose: 'cuando sea', id: 2 },
      { dose: 'en ayunas', id: 3 },
    ]);
    expect(groups.map((g) => [g.moment, g.items.map((i) => i.id)])).toEqual([
      ['manana', [3]],
      ['noche', [1]],
      ['libre', [2]],
    ]);
  });

  it('currentMoment por hora local', () => {
    expect(currentMoment(new Date(2026, 0, 1, 8))).toBe('manana');
    expect(currentMoment(new Date(2026, 0, 1, 14))).toBe('mediodia');
    expect(currentMoment(new Date(2026, 0, 1, 21))).toBe('noche');
  });
});
