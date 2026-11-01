import { formatNutrient, nutrientsToText, parseNutrients } from './nutrients';

describe('parseNutrients', () => {
  it('lee una tabla nutricional escaneada (español, %VD, unidades variadas)', () => {
    const scanned = `Información nutrimental
Porción: 1 cápsula
Magnesio (bisglicinato) 200 mg 48%
Vitamina D3 2000 UI 250%
Zinc 15 mg
Vitamina B12 (metilcobalamina) 500 µg`;
    const out = parseNutrients(scanned);
    expect(out.map(formatNutrient)).toEqual([
      'Magnesio 200 mg',
      'Vitamina D 50 µg',
      'Zinc 15 mg',
      'Vitamina B12 500 µg',
    ]);
  });

  it('convierte unidades al tipo de Salud (g→mg, mg→µg) y acepta coma decimal', () => {
    const out = parseNutrients('Hierro 0,018 g; Ácido fólico 0.4 mg; Proteína 20 g');
    expect(out.map((n) => [n.key, n.amount, n.unit])).toEqual([
      ['iron', 18, 'mg'],
      ['folate', 400, 'mcg'],
      ['protein', 20, 'g'],
    ]);
  });

  it('ignora líneas sin unidad, UI de vitamina A y nutrientes repetidos', () => {
    const out = parseNutrients('Magnesio\nVitamina A 5000 UI\nMagnesio 100 mg\nMagnesio 300 mg');
    expect(out.map(formatNutrient)).toEqual(['Magnesio 100 mg']);
  });

  it('lee varios nutrientes en el mismo segmento (comas o «y»)', () => {
    const out = parseNutrients('Vitamina D 50 µg, Vitamina K 100 µg y Calcio 0,5 g');
    expect(out.map(formatNutrient)).toEqual([
      'Vitamina D 50 µg',
      'Vitamina K 100 µg',
      'Calcio 500 mg',
    ]);
  });

  it('no le asigna a un nutriente sin cantidad la del siguiente', () => {
    const out = parseNutrients('Calcio y magnesio 300 mg');
    expect(out.map(formatNutrient)).toEqual(['Magnesio 300 mg']);
  });

  it('no confunde «b12» con «b1» ni toma la línea de porcentaje', () => {
    const out = parseNutrients('Vitamina B12 2,4 mcg');
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('vitB12');
    expect(out[0].amount).toBeCloseTo(2.4);
  });

  it('miles con punto o coma', () => {
    expect(parseNutrients('Vitamina D 1.000 UI')[0].amount).toBe(25);
    expect(parseNutrients('Calcio 1,000 mg')[0].amount).toBe(1000);
  });

  it('nutrientsToText produce texto estable para Notion', () => {
    expect(nutrientsToText(parseNutrients('magnesium 200mg; vitamin c 1 g'))).toBe(
      'Magnesio 200 mg; Vitamina C 1000 mg',
    );
    // Ida y vuelta: el texto guardado se vuelve a leer igual.
    const text = nutrientsToText(parseNutrients('Vitamina D3 2000 UI\nZinc 15 mg'));
    expect(nutrientsToText(parseNutrients(text))).toBe(text);
  });
});
