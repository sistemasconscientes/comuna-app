/**
 * Nutrientes por toma: parsea texto libre (escrito o escaneado con «Escanear
 * texto» de iOS sobre la tabla nutricional) y lo mapea a tipos dietéticos de
 * Apple Salud. Solo se reconocen nutrientes con cantidad y unidad explícitas:
 * ante la duda no se escribe nada (guideline 5.1.3(ii): no datos inexactos).
 */

export type NutrientUnit = 'g' | 'mg' | 'mcg';

export interface NutrientDef {
  key: string;
  label: string;
  /** Identificador `HKQuantityTypeIdentifierDietary…`. */
  hkIdentifier: string;
  unit: NutrientUnit;
  /** Alias normalizados (minúsculas, sin acentos), del más específico al más general. */
  aliases: string[];
  /** Factor UI → `unit` (solo vitamina D: 40 UI = 1 µg). */
  iuToUnit?: number;
}

const DIET = 'HKQuantityTypeIdentifierDietary';

export const NUTRIENTS: NutrientDef[] = [
  {
    key: 'vitD',
    label: 'Vitamina D',
    hkIdentifier: `${DIET}VitaminD`,
    unit: 'mcg',
    aliases: [
      'vitamina d3',
      'vitamina d',
      'vitamin d3',
      'vitamin d',
      'colecalciferol',
      'cholecalciferol',
    ],
    iuToUnit: 1 / 40,
  },
  {
    key: 'vitB12',
    label: 'Vitamina B12',
    hkIdentifier: `${DIET}VitaminB12`,
    unit: 'mcg',
    aliases: [
      'vitamina b12',
      'vitamin b12',
      'cianocobalamina',
      'metilcobalamina',
      'methylcobalamin',
      'cyanocobalamin',
      'b12',
    ],
  },
  {
    key: 'vitB6',
    label: 'Vitamina B6',
    hkIdentifier: `${DIET}VitaminB6`,
    unit: 'mg',
    aliases: ['vitamina b6', 'vitamin b6', 'piridoxina', 'pyridoxine', 'b6'],
  },
  {
    key: 'vitC',
    label: 'Vitamina C',
    hkIdentifier: `${DIET}VitaminC`,
    unit: 'mg',
    aliases: ['vitamina c', 'vitamin c', 'acido ascorbico', 'ascorbic acid'],
  },
  {
    key: 'vitE',
    label: 'Vitamina E',
    hkIdentifier: `${DIET}VitaminE`,
    unit: 'mg',
    aliases: ['vitamina e', 'vitamin e', 'tocoferol', 'tocopherol'],
  },
  {
    key: 'vitK',
    label: 'Vitamina K',
    hkIdentifier: `${DIET}VitaminK`,
    unit: 'mcg',
    aliases: ['vitamina k2', 'vitamina k', 'vitamin k2', 'vitamin k', 'menaquinona', 'menaquinone'],
  },
  {
    key: 'vitA',
    label: 'Vitamina A',
    hkIdentifier: `${DIET}VitaminA`,
    unit: 'mcg',
    aliases: ['vitamina a', 'vitamin a', 'retinol'],
  },
  {
    key: 'folate',
    label: 'Folato',
    hkIdentifier: `${DIET}Folate`,
    unit: 'mcg',
    aliases: [
      'acido folico',
      'folic acid',
      'folato',
      'folate',
      'metilfolato',
      'methylfolate',
      'vitamina b9',
      'b9',
    ],
  },
  {
    key: 'biotin',
    label: 'Biotina',
    hkIdentifier: `${DIET}Biotin`,
    unit: 'mcg',
    aliases: ['biotina', 'biotin', 'vitamina b7', 'b7'],
  },
  {
    key: 'niacin',
    label: 'Niacina',
    hkIdentifier: `${DIET}Niacin`,
    unit: 'mg',
    aliases: ['niacina', 'niacin', 'niacinamida', 'niacinamide', 'vitamina b3', 'b3'],
  },
  {
    key: 'riboflavin',
    label: 'Riboflavina',
    hkIdentifier: `${DIET}Riboflavin`,
    unit: 'mg',
    aliases: ['riboflavina', 'riboflavin', 'vitamina b2', 'b2'],
  },
  {
    key: 'thiamin',
    label: 'Tiamina',
    hkIdentifier: `${DIET}Thiamin`,
    unit: 'mg',
    aliases: ['tiamina', 'thiamine', 'thiamin', 'vitamina b1', 'b1'],
  },
  {
    key: 'pantothenic',
    label: 'Ácido pantoténico',
    hkIdentifier: `${DIET}PantothenicAcid`,
    unit: 'mg',
    aliases: ['acido pantotenico', 'pantothenic acid', 'vitamina b5', 'b5'],
  },
  {
    key: 'magnesium',
    label: 'Magnesio',
    hkIdentifier: `${DIET}Magnesium`,
    unit: 'mg',
    aliases: ['magnesio', 'magnesium'],
  },
  {
    key: 'iron',
    label: 'Hierro',
    hkIdentifier: `${DIET}Iron`,
    unit: 'mg',
    aliases: ['hierro', 'iron'],
  },
  {
    key: 'zinc',
    label: 'Zinc',
    hkIdentifier: `${DIET}Zinc`,
    unit: 'mg',
    aliases: ['zinc', 'cinc'],
  },
  {
    key: 'calcium',
    label: 'Calcio',
    hkIdentifier: `${DIET}Calcium`,
    unit: 'mg',
    aliases: ['calcio', 'calcium'],
  },
  {
    key: 'potassium',
    label: 'Potasio',
    hkIdentifier: `${DIET}Potassium`,
    unit: 'mg',
    aliases: ['potasio', 'potassium'],
  },
  {
    key: 'selenium',
    label: 'Selenio',
    hkIdentifier: `${DIET}Selenium`,
    unit: 'mcg',
    aliases: ['selenio', 'selenium'],
  },
  {
    key: 'iodine',
    label: 'Yodo',
    hkIdentifier: `${DIET}Iodine`,
    unit: 'mcg',
    aliases: ['yodo', 'iodine'],
  },
  {
    key: 'copper',
    label: 'Cobre',
    hkIdentifier: `${DIET}Copper`,
    unit: 'mg',
    aliases: ['cobre', 'copper'],
  },
  {
    key: 'manganese',
    label: 'Manganeso',
    hkIdentifier: `${DIET}Manganese`,
    unit: 'mg',
    aliases: ['manganeso', 'manganese'],
  },
  {
    key: 'chromium',
    label: 'Cromo',
    hkIdentifier: `${DIET}Chromium`,
    unit: 'mcg',
    aliases: ['cromo', 'chromium'],
  },
  {
    key: 'molybdenum',
    label: 'Molibdeno',
    hkIdentifier: `${DIET}Molybdenum`,
    unit: 'mcg',
    aliases: ['molibdeno', 'molybdenum'],
  },
  {
    key: 'phosphorus',
    label: 'Fósforo',
    hkIdentifier: `${DIET}Phosphorus`,
    unit: 'mg',
    aliases: ['fosforo', 'phosphorus'],
  },
  {
    key: 'caffeine',
    label: 'Cafeína',
    hkIdentifier: `${DIET}Caffeine`,
    unit: 'mg',
    aliases: ['cafeina', 'caffeine'],
  },
  {
    key: 'protein',
    label: 'Proteína',
    hkIdentifier: `${DIET}Protein`,
    unit: 'g',
    aliases: ['proteina', 'protein'],
  },
  {
    key: 'fiber',
    label: 'Fibra',
    hkIdentifier: `${DIET}Fiber`,
    unit: 'g',
    aliases: ['fibra dietetica', 'fibra', 'dietary fiber', 'fiber', 'fibre'],
  },
];

export interface ParsedNutrient {
  key: string;
  label: string;
  hkIdentifier: string;
  /** Cantidad ya convertida a `unit`. */
  amount: number;
  unit: NutrientUnit;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/µ|μ/g, 'u');
}

const UNIT_FACTORS: Record<string, Record<NutrientUnit, number>> = {
  g: { g: 1, mg: 1000, mcg: 1_000_000 },
  mg: { g: 0.001, mg: 1, mcg: 1000 },
  mcg: { g: 0.000001, mg: 0.001, mcg: 1 },
};

function canonicalUnit(raw: string): 'g' | 'mg' | 'mcg' | 'iu' | null {
  const u = raw.replace(/\./g, '');
  if (u === 'mg') return 'mg';
  if (u === 'mcg' || u === 'ug') return 'mcg';
  if (u === 'g' || u === 'gr') return 'g';
  if (u === 'ui' || u === 'iu') return 'iu';
  return null;
}

/** Número con coma o punto decimal y separador de miles opcional. */
function parseAmount(raw: string): number {
  const s = raw.replace(/\s/g, '');
  // «1.000» / «1,000» (miles) vs «2,5» / «2.5» (decimal)
  if (/^[1-9]\d{0,2}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
  return Number(s.replace(',', '.'));
}

const AMOUNT_RE = /(\d+(?:[.,]\d+)*)\s*(mg|mcg|ug|g|gr|ui|iu)\b\.?/;

/**
 * Busca en cada línea (o segmento separado por «;») un nutriente conocido y la
 * primera cantidad+unidad que le sigue. Ignora porcentajes (%VD) y líneas sin
 * unidad. Un nutriente aparece una sola vez (gana la primera línea).
 */
export function parseNutrients(text: string): ParsedNutrient[] {
  const out: ParsedNutrient[] = [];
  const seen = new Set<string>();
  const segments = normalize(text).split(/[\n;]+/);
  for (const seg of segments) {
    for (const def of NUTRIENTS) {
      if (seen.has(def.key)) continue;
      const alias = def.aliases.find((a) => new RegExp(`(^|[^a-z0-9])${a}([^a-z0-9]|$)`).test(seg));
      if (!alias) continue;
      const after = seg.slice(seg.indexOf(alias) + alias.length);
      const m = AMOUNT_RE.exec(after);
      if (!m) continue;
      const value = parseAmount(m[1]);
      const unit = canonicalUnit(m[2]);
      if (!unit || !Number.isFinite(value) || value <= 0) continue;
      let amount: number;
      if (unit === 'iu') {
        if (!def.iuToUnit) continue; // UI de vitamina A/E depende de la forma: no adivinar
        amount = value * def.iuToUnit;
      } else {
        amount = value * UNIT_FACTORS[unit][def.unit];
      }
      seen.add(def.key);
      out.push({
        key: def.key,
        label: def.label,
        hkIdentifier: def.hkIdentifier,
        amount,
        unit: def.unit,
      });
      break;
    }
  }
  return out;
}

const UNIT_LABEL: Record<NutrientUnit, string> = { g: 'g', mg: 'mg', mcg: 'µg' };

export function formatNutrient(n: ParsedNutrient): string {
  const rounded = n.amount >= 10 ? Math.round(n.amount) : Math.round(n.amount * 100) / 100;
  return `${n.label} ${rounded} ${UNIT_LABEL[n.unit]}`;
}

/** Texto canónico para guardar en Notion: «Magnesio 200 mg; Vitamina D 25 µg». */
export function nutrientsToText(list: ParsedNutrient[]): string {
  return list.map(formatNutrient).join('; ');
}
