import { cyclePhaseToPhase, normalizePhase, phaseToCyclePhase } from './phaseUtils';

describe('normalizePhase', () => {
  describe('🩸 menstrual', () => {
    it('reconoce "menstrual"', () => expect(normalizePhase('menstrual')).toBe('menstrual'));
    it('reconoce "Menstrual"', () => expect(normalizePhase('Menstrual')).toBe('menstrual'));
    it('reconoce "MENSTRUAL"', () => expect(normalizePhase('MENSTRUAL')).toBe('menstrual'));
    it('reconoce "🩸 menstrual"', () => expect(normalizePhase('🩸 menstrual')).toBe('menstrual'));
    it('reconoce "Menstruación 🩸" (celda Notion)', () =>
      expect(normalizePhase('Menstruación 🩸')).toBe('menstrual'));
  });

  describe('🌸 folicular', () => {
    it('reconoce "folicular"', () => expect(normalizePhase('folicular')).toBe('folicular'));
    it('reconoce "follicular"', () => expect(normalizePhase('follicular')).toBe('folicular'));
    it('reconoce "FOLICULAR"', () => expect(normalizePhase('FOLICULAR')).toBe('folicular'));
  });

  describe('🌕 ovulatoria', () => {
    it('reconoce "ovulatoria"', () => expect(normalizePhase('ovulatoria')).toBe('ovulatoria'));
    it('reconoce "ovulacion"', () => expect(normalizePhase('ovulacion')).toBe('ovulatoria'));
    it('reconoce "ovulación"', () => expect(normalizePhase('ovulación')).toBe('ovulatoria'));
    it('reconoce "ovulatoria 🌸"', () =>
      expect(normalizePhase('ovulatoria 🌸')).toBe('ovulatoria'));
  });

  describe('🍂 lutea', () => {
    it('reconoce "lutea"', () => expect(normalizePhase('lutea')).toBe('lutea'));
    it('reconoce "lútea"', () => expect(normalizePhase('lútea')).toBe('lutea'));
    it('reconoce "luteal"', () => expect(normalizePhase('luteal')).toBe('lutea'));
  });

  describe('✨ all', () => {
    it('reconoce "all"', () => expect(normalizePhase('all')).toBe('all'));
    it('reconoce "todas"', () => expect(normalizePhase('todas')).toBe('all'));
    it('reconoce "ambas"', () => expect(normalizePhase('ambas')).toBe('all'));
    it('reconoce "siempre"', () => expect(normalizePhase('siempre')).toBe('all'));
  });

  describe('❌ inválidos', () => {
    it('retorna null para ""', () => expect(normalizePhase('')).toBeNull());
    it('retorna null para "  "', () => expect(normalizePhase('  ')).toBeNull());
    it('retorna null para "unknown"', () => expect(normalizePhase('unknown')).toBeNull());
  });
});

describe('🔄 phaseToCyclePhase', () => {
  it('"ovulatoria" → "ovulacion"', () => expect(phaseToCyclePhase('ovulatoria')).toBe('ovulacion'));
  it('"menstrual" → "menstrual"', () => expect(phaseToCyclePhase('menstrual')).toBe('menstrual'));
  it('"folicular" → "folicular"', () => expect(phaseToCyclePhase('folicular')).toBe('folicular'));
  it('"lutea" → "lutea"', () => expect(phaseToCyclePhase('lutea')).toBe('lutea'));
});

describe('cyclePhaseToPhase', () => {
  it('"ovulacion" → "ovulatoria"', () => expect(cyclePhaseToPhase('ovulacion')).toBe('ovulatoria'));
  it('"menstrual" → "menstrual"', () => expect(cyclePhaseToPhase('menstrual')).toBe('menstrual'));
  it('"folicular" → "folicular"', () => expect(cyclePhaseToPhase('folicular')).toBe('folicular'));
  it('"lutea" → "lutea"', () => expect(cyclePhaseToPhase('lutea')).toBe('lutea'));
});
