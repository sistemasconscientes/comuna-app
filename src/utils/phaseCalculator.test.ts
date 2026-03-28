import { getPhaseFromCycleDay, getCycleDayFromDate, getCurrentCycleInfo } from './phaseCalculator';

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
