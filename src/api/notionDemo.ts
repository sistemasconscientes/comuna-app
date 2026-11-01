import type { ProfileId } from '../config/profiles';
import { getNotionSupplementPersona, isSharedPersona, profileIndex } from '../config/profiles';
import type { Chore, Supplement, Tea } from '../types';

/**
 * Datos de ejemplo del modo demo (sin Notion): dejan probar la app —y pasar
 * App Review— sin crear una integración. Los escribe `notion.ts` cuando
 * `isDemoMode()`; las escrituras (fase, recompra) son no-op.
 */

/** Personas de la "tabla de fases" demo (siguen ciclo); también nombran los perfiles. */
export const DEMO_CYCLE_PROFILE_LABELS = ['Luna', 'Mar'] as const;
/** Persona demo que no sigue ciclo (roomie): solo suplementos sin fase. */
export const DEMO_NO_CYCLE_PROFILE_LABELS = ['Sol'] as const;

const DEMO_SUPPLEMENTS: Supplement[] = [
  {
    notion_id: 'demo-magnesio',
    name: 'Magnesio bisglicinato',
    category: ['Minerales'],
    dose: '200 mg por la noche',
    phase_specific: 'all',
    temporadaLabels: [],
    persona: 'Compartido',
  },
  {
    notion_id: 'demo-omega3',
    name: 'Omega 3',
    category: ['Ácidos grasos'],
    dose: '1 g con comida',
    phase_specific: 'all',
    temporadaLabels: [],
    persona: 'Compartido',
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
  {
    notion_id: 'demo-creatina',
    name: 'Creatina',
    category: ['Rendimiento'],
    dose: '5 g con el desayuno',
    phase_specific: 'all',
    temporadaLabels: [],
    persona: 'Sol',
  },
];

export function demoSupplements(user: ProfileId): Supplement[] {
  const persona = getNotionSupplementPersona(user);
  return DEMO_SUPPLEMENTS.filter((s) => isSharedPersona(s.persona) || s.persona === persona);
}

/** Misma forma que la tabla de fases real: label con emoji + próximo ciclo. */
export function demoCurrentPhase(user: ProfileId): { phase: string; nextCycle: Date } {
  const first = profileIndex(user) <= 0;
  const daysAhead = first ? 12 : 21;
  const phase = first ? 'Folicular 🌸' : 'Lútea 🦥';
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

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Tareas de ejemplo: diaria compartida, por persona, atrasada y de días fijos. */
export function demoChores(): Chore[] {
  const todayDow = new Date().getDay();
  const base = { everyNDays: null, weekdays: [] as number[], doneBy: '', notes: '' };
  return [
    {
      ...base,
      notion_id: 'demo-trastes',
      name: 'Lavar trastes',
      frequency: 'diaria',
      persona: 'Compartido',
      lastDone: isoDaysAgo(1),
    },
    {
      ...base,
      notion_id: 'demo-basura',
      name: 'Sacar la basura',
      frequency: 'semanal',
      persona: 'Luna',
      lastDone: null,
      weekdays: [todayDow],
    },
    {
      ...base,
      notion_id: 'demo-plantas',
      name: 'Regar plantas',
      frequency: 'cada_n_dias',
      everyNDays: 3,
      persona: 'Mar',
      lastDone: isoDaysAgo(4),
    },
    {
      ...base,
      notion_id: 'demo-banio',
      name: 'Limpiar baño',
      frequency: 'semanal',
      persona: 'Sol',
      lastDone: isoDaysAgo(9),
      notes: 'Productos bajo el lavabo',
    },
    {
      ...base,
      notion_id: 'demo-sabanas',
      name: 'Cambiar sábanas',
      frequency: 'quincenal',
      persona: 'Compartido',
      lastDone: isoDaysAgo(3),
    },
  ];
}
