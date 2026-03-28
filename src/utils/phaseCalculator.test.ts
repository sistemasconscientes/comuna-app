import {
  derivePeriodStartFromFlowSampleDates,
  getPhaseFromCycleDay,
  getCycleDayFromDate,
  getCurrentCycleInfo,
  getCurrentCycleInfoWithHealthKitRefinements,
  inferBbtRiseAnchorFromSamples,
} from './phaseCalculator';

describe('📅 getPhaseFromCycleDay', () => {
  describe('🩸 menstrual — días 1-5', () => {
    it('día 1 → menstrual', () => expect(getPhaseFromCycleDay(1)).toBe('menstrual'));
    it('día 3 → menstrual', () => expect(getPhaseFromCycleDay(3)).toBe('menstrual'));
    it('día 5 → menstrual', () => expect(getPhaseFromCycleDay(5)).toBe('menstrual'));
  });

  describe('🌸 folicular — días 6-12', () => {
    it('día 6 → folicular', () => expect(getPhaseFromCycleDay(6)).toBe('folicular'));
    it('día 9 → folicular', () => expect(getPhaseFromCycleDay(9)).toBe('folicular'));
    it('día 12 → folicular', () => expect(getPhaseFromCycleDay(12)).toBe('folicular'));
  });

  describe('🌕 ovulatoria — días 13-15', () => {
    it('día 13 → ovulacion', () => expect(getPhaseFromCycleDay(13)).toBe('ovulacion'));
    it('día 14 → ovulacion', () => expect(getPhaseFromCycleDay(14)).toBe('ovulacion'));
    it('día 15 → ovulacion', () => expect(getPhaseFromCycleDay(15)).toBe('ovulacion'));
  });

  describe('🍂 lútea — días 16-28', () => {
    it('día 16 → lutea', () => expect(getPhaseFromCycleDay(16)).toBe('lutea'));
    it('día 22 → lutea', () => expect(getPhaseFromCycleDay(22)).toBe('lutea'));
    it('día 28 → lutea', () => expect(getPhaseFromCycleDay(28)).toBe('lutea'));
  });

  describe('⚙️ config custom', () => {
    const config = { cycleLength: 30, lutealLength: 12 };
    // ovulationDay = 30 - 12 = 18
    // folicular: 6 to <17 (days 6-16)
    // ovulacion: 17-19
    // lutea: 20+
    it('día 16 → folicular (boundary)', () => expect(getPhaseFromCycleDay(16, config)).toBe('folicular'));
    it('día 17 → ovulacion (boundary)', () => expect(getPhaseFromCycleDay(17, config)).toBe('ovulacion'));
    it('día 19 → ovulacion', () => expect(getPhaseFromCycleDay(19, config)).toBe('ovulacion'));
    it('día 20 → lutea', () => expect(getPhaseFromCycleDay(20, config)).toBe('lutea'));
  });
});

describe('🗓️ getCycleDayFromDate', () => {
  /** Días civiles locales (no solo 24 h UTC), coherente con `phaseCalculator`. */
  const base = new Date(2025, 0, 1);

  const addLocalDays = (d: Date, n: number) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    return x;
  };

  it('mismo día → día 1', () => {
    expect(getCycleDayFromDate(base, base)).toBe(1);
  });

  it('+27 días civiles locales → día 28', () => {
    expect(getCycleDayFromDate(base, addLocalDays(base, 27))).toBe(28);
  });

  it('+28 días civiles locales → día 1 (wraps)', () => {
    expect(getCycleDayFromDate(base, addLocalDays(base, 28))).toBe(1);
  });

  it('+35 días civiles locales → día 8', () => {
    expect(getCycleDayFromDate(base, addLocalDays(base, 35))).toBe(8);
  });
});

describe('🔮 getCurrentCycleInfo', () => {
  it('resultado coherente (phase + day)', () => {
    const lastPeriodStart = new Date();
    const info = getCurrentCycleInfo(lastPeriodStart);
    expect(info).toHaveProperty('day');
    expect(info).toHaveProperty('phase');
    expect(info.day).toBe(1);
    expect(info.phase).toBe('menstrual');
  });
});

describe('derivePeriodStartFromFlowSampleDates', () => {
  it('una sola fecha → ese día (inicio del episodio)', () => {
    const d = new Date(2026, 2, 26, 18, 0, 0);
    const r = derivePeriodStartFromFlowSampleDates([d]);
    expect(r?.getFullYear()).toBe(2026);
    expect(r?.getMonth()).toBe(2);
    expect(r?.getDate()).toBe(26);
  });

  it('último día de regla + días anteriores → usa el primer día del episodio', () => {
    const first = new Date(2026, 2, 22, 8, 0, 0);
    const last = new Date(2026, 2, 26, 20, 0, 0);
    const r = derivePeriodStartFromFlowSampleDates([last, first]);
    expect(r?.getDate()).toBe(22);
  });

  it('hueco > 7 días entre muestras → solo el episodio más reciente', () => {
    const oldFlow = new Date(2026, 1, 1, 12, 0, 0);
    const newFlow = new Date(2026, 2, 26, 12, 0, 0);
    const r = derivePeriodStartFromFlowSampleDates([newFlow, oldFlow]);
    expect(r?.getMonth()).toBe(2);
    expect(r?.getDate()).toBe(26);
  });
});

describe('getCurrentCycleInfoWithHealthKitRefinements', () => {
  const lastStart = new Date(2026, 2, 1);

  it('sin señales → igual que getCurrentCycleInfo', () => {
    const a = getCurrentCycleInfo(lastStart);
    const b = getCurrentCycleInfoWithHealthKitRefinements(lastStart, {
      ovulationSignalDate: null,
      peakFertileMucusDate: null,
      bbtRiseAnchorDate: null,
    });
    expect(b).toEqual(a);
  });

  it('pico LH en ventana fuerza ovulación aunque el modelo diga menstrual', () => {
    const today = new Date(2026, 2, 5, 10, 0, 0);
    const r = getCurrentCycleInfoWithHealthKitRefinements(
      lastStart,
      {
        ovulationSignalDate: new Date(2026, 2, 5, 8, 0, 0),
        peakFertileMucusDate: null,
        bbtRiseAnchorDate: null,
      },
      undefined,
      today,
    );
    expect(r.phase).toBe('ovulacion');
    expect(r.day).toBe(5);
  });
});

describe('inferBbtRiseAnchorFromSamples', () => {
  it('menos de 10 muestras → null', () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({
      date: new Date(2026, 0, i + 1),
      value: 36.4,
    }));
    expect(inferBbtRiseAnchorFromSamples(rows, false)).toBeNull();
  });

  it('subida clara en °C devuelve ancla (primer día del bloque alto)', () => {
    const rows = [
      ...Array.from({ length: 7 }, (_, i) => ({
        date: new Date(2026, 0, i + 1),
        value: 36.35 + i * 0.01,
      })),
      { date: new Date(2026, 0, 8), value: 36.55 },
      { date: new Date(2026, 0, 9), value: 36.58 },
      { date: new Date(2026, 0, 10), value: 36.6 },
    ];
    const anchor = inferBbtRiseAnchorFromSamples(rows, false);
    expect(anchor).not.toBeNull();
    expect(anchor!.getDate()).toBe(8);
  });
});
