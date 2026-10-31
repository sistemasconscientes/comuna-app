import { estimateEnergy, groupSleepByNight, todayNightKey } from './energy';

const H = 60 * 60 * 1000;

function nightsWith(last: number, previous: number[]) {
  const out = [{ night: '2026-10-31', asleepMs: last * H }];
  previous.forEach((h, i) => {
    out.push({ night: `2026-10-${String(30 - i).padStart(2, '0')}`, asleepMs: h * H });
  });
  return out;
}

describe('groupSleepByNight', () => {
  it('asigna tramos a la noche del día de despertar y fusiona solapes', () => {
    const start = new Date(2026, 9, 30, 23, 0).getTime();
    const nights = groupSleepByNight([
      { startMs: start, endMs: start + 7 * H }, // iPhone
      { startMs: start + 1 * H, endMs: start + 6 * H }, // Watch (solapado)
    ]);
    expect(nights).toEqual([{ night: '2026-10-31', asleepMs: 7 * H }]);
  });
});

describe('estimateEnergy', () => {
  it('sin sueño de anoche no estima', () => {
    expect(estimateEnergy([{ night: '2026-10-30', asleepMs: 8 * H }], '2026-10-31')).toBeNull();
  });

  it('usa tu mediana con 5+ noches previas', () => {
    const e = estimateEnergy(nightsWith(6, [8, 8, 8, 8, 8]), '2026-10-31')!;
    expect(e.usedPersonalBaseline).toBe(true);
    expect(e.baselineMs).toBe(8 * H);
    expect(e.level).toBe('baja'); // 6/8 = 75 %
  });

  it('con pocas noches compara contra 7 h 30', () => {
    const e = estimateEnergy(nightsWith(7.2, [7]), '2026-10-31')!;
    expect(e.usedPersonalBaseline).toBe(false);
    expect(e.level).toBe('alta'); // 96 %
  });

  it('menos de 5 h siempre es baja; 6 h–6 h 30 es media', () => {
    expect(estimateEnergy(nightsWith(4.5, [5, 5, 5, 5, 5]), '2026-10-31')!.level).toBe('baja');
    expect(estimateEnergy(nightsWith(6.2, [6.2, 6.2, 6.2, 6.2, 6.2]), '2026-10-31')!.level).toBe(
      'media',
    );
  });

  it('la fase agrega matiz sin cambiar el nivel', () => {
    const e = estimateEnergy(nightsWith(8, [8, 8, 8, 8, 8]), '2026-10-31', 'lutea')!;
    expect(e.level).toBe('alta');
    expect(e.phaseNote).toMatch(/lútea/);
    expect(estimateEnergy(nightsWith(8, [8]), '2026-10-31', 'folicular')!.phaseNote).toBeNull();
  });

  it('todayNightKey usa el calendario local', () => {
    expect(todayNightKey(new Date(2026, 0, 5, 9))).toBe('2026-01-05');
  });
});
