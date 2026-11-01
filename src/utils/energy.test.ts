import { estimateEnergy, groupSleepByNight, todayNightKey } from './energy';
import type { CyclePhase } from '../types';

const H = 60 * 60 * 1000;

/** Noche de hoy + noches previas (más reciente primero), claves 2026-10-31, 30, 29… */
function nightsWith(last: number, previous: number[]) {
  const out = [{ night: '2026-10-31', asleepMs: last * H }];
  previous.forEach((h, i) => {
    const d = new Date(2026, 9, 30 - i);
    out.push({ night: todayNightKey(d), asleepMs: h * H });
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

describe('estimateEnergy sin ciclo', () => {
  it('sin sueño de anoche no estima', () => {
    expect(estimateEnergy([{ night: '2026-10-30', asleepMs: 8 * H }], '2026-10-31')).toBeNull();
  });

  it('usa tu mediana reciente con 5+ noches previas', () => {
    const e = estimateEnergy(nightsWith(6, [8, 8, 8, 8, 8]), '2026-10-31')!;
    expect(e.baselineKind).toBe('personal');
    expect(e.baselineMs).toBe(8 * H);
    expect(e.level).toBe('baja'); // 6/8 = 75 %
    expect(e.phaseNote).toBeNull();
  });

  it('con pocas noches compara contra 7 h 30', () => {
    const e = estimateEnergy(nightsWith(7.2, [7]), '2026-10-31')!;
    expect(e.baselineKind).toBe('referencia');
    expect(e.level).toBe('alta'); // 96 %
  });

  it('menos de 5 h siempre es baja; 6 h–6 h 30 es media', () => {
    expect(estimateEnergy(nightsWith(4.5, [5, 5, 5, 5, 5]), '2026-10-31')!.level).toBe('baja');
    expect(estimateEnergy(nightsWith(6.2, [6.2, 6.2, 6.2, 6.2, 6.2]), '2026-10-31')!.level).toBe(
      'media',
    );
  });
});

describe('estimateEnergy según fase', () => {
  // 10 noches previas: las pares en lútea durmiendo 6 h 30, las impares en folicular 8 h.
  const previous = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? 6.5 : 8));
  const phaseOfNight = (night: string): CyclePhase => {
    const idx = Math.round((new Date(2026, 9, 30).getTime() - new Date(night).getTime()) / 864e5);
    return idx % 2 === 0 ? 'lutea' : 'folicular';
  };

  it('compara contra tu mediana de la misma fase', () => {
    const e = estimateEnergy(nightsWith(7, previous), '2026-10-31', {
      phase: 'lutea',
      phaseOfNight,
    })!;
    expect(e.baselineKind).toBe('fase');
    expect(e.baselineMs).toBe(6.5 * H);
  });

  it('en lútea pide más horas para «alta» que en folicular', () => {
    const night = nightsWith(6.8, [6.8, 6.8, 6.8, 6.8, 6.8]);
    expect(estimateEnergy(night, '2026-10-31', { phase: 'folicular' })!.level).toBe('alta');
    const lutea = estimateEnergy(night, '2026-10-31', { phase: 'lutea' })!;
    expect(lutea.phaseAdjusted).toBe(true);
    expect(lutea.level).toBe('media'); // < 7 h en fase sensible
    expect(lutea.phaseNote).toMatch(/lútea/);
  });

  it('con anticonceptivo hormonal, embarazo o lactancia no ajusta por fase', () => {
    const night = nightsWith(6.8, [6.8, 6.8, 6.8, 6.8, 6.8]);
    for (const lifecycleContext of ['contraceptive', 'pregnancy', 'lactation'] as const) {
      const e = estimateEnergy(night, '2026-10-31', {
        phase: 'lutea',
        phaseOfNight,
        lifecycleContext,
      })!;
      expect(e.phaseAdjusted).toBe(false);
      expect(e.baselineKind).toBe('personal');
      expect(e.level).toBe('alta');
      expect(e.phaseNote).toMatch(/patrón de sueño por fase cambia/);
    }
  });

  it('todayNightKey usa el calendario local', () => {
    expect(todayNightKey(new Date(2026, 0, 5, 9))).toBe('2026-01-05');
  });
});
