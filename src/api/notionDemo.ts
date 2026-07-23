import type { ProfileId } from '../config/profiles';
import { getNotionSupplementPersona } from '../config/profiles';
import type { Supplement, Tea } from '../types';

/**
 * Datos de ejemplo del modo demo (sin Notion): dejan probar la app —y pasar
 * App Review— sin crear una integración. Los escribe `notion.ts` cuando
 * `isDemoMode()`; las escrituras (fase, recompra) son no-op.
 */

/** Personas de la "tabla de fases" demo; también nombran los perfiles. */
export const DEMO_PROFILE_LABELS = ['Luna', 'Mar'] as const;

const DEMO_SUPPLEMENTS: Supplement[] = [
  {
    notion_id: 'demo-magnesio',
    name: 'Magnesio bisglicinato',
    category: ['Minerales'],
    dose: '200 mg por la noche',
    phase_specific: 'all',
    temporadaLabels: [],
    persona: 'Ambas',
  },
  {
    notion_id: 'demo-omega3',
    name: 'Omega 3',
    category: ['Ácidos grasos'],
    dose: '1 g con comida',
    phase_specific: 'all',
    temporadaLabels: [],
    persona: 'Ambas',
  },
  {
    notion_id: 'demo-vitd',
    name: 'Vitamina D3 + K2',
    category: ['Vitaminas'],
    dose: '2000 UI al desayuno',
    phase_specific: 'all',
    temporadaLabels: [],
    persona: 'Luna',
  },
  {
    notion_id: 'demo-hierro',
    name: 'Hierro',
    category: ['Minerales'],
    dose: '15 mg en ayunas',
    phase_specific: 'menstrual',
    temporadaLabels: [],
    persona: 'Luna',
  },
  {
    notion_id: 'demo-maca',
    name: 'Maca',
    category: ['Adaptógenos'],
    dose: '1 cdta en licuado',
    phase_specific: 'folicular',
    temporadaLabels: [],
    persona: 'Mar',
  },
  {
    notion_id: 'demo-ashwagandha',
    name: 'Ashwagandha',
    category: ['Adaptógenos'],
    dose: '300 mg por la tarde',
    phase_specific: 'lutea',
    temporadaLabels: [],
    persona: 'Mar',
  },
];

export function demoSupplements(user: ProfileId): Supplement[] {
  const persona = getNotionSupplementPersona(user);
  return DEMO_SUPPLEMENTS.filter((s) => s.persona === 'Ambas' || s.persona === persona);
}

/** Misma forma que la tabla de fases real: label con emoji + próximo ciclo. */
export function demoCurrentPhase(user: ProfileId): { phase: string; nextCycle: Date } {
  const daysAhead = user === 'profile_1' ? 12 : 21;
  const phase = user === 'profile_1' ? 'Folicular 🌸' : 'Lútea 🦥';
  const nextCycle = new Date();
  nextCycle.setDate(nextCycle.getDate() + daysAhead);
  return { phase, nextCycle };
}

const DEMO_TEAS: Tea[] = [
  {
    notion_id: 'demo-te-jengibre',
    name: 'Té de jengibre',
    comprovable_benefits: ['Antiinflamatorio'],
    holistic_benefits: ['Calor interno'],
  },
  {
    notion_id: 'demo-te-manzanilla',
    name: 'Manzanilla',
    comprovable_benefits: ['Digestivo'],
    holistic_benefits: ['Calma'],
  },
];

export function demoTeas(): Tea[] {
  return DEMO_TEAS;
}
