import type { User } from '../context/UserContext';

// ─────────────────────────────────────────────────────────────────────────────
// Notion-facing types (as per product spec)
// ─────────────────────────────────────────────────────────────────────────────

export type { User };

export type Phase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea';

/** Valor del select `Persona` en la base de suplementos de Notion. */
/**
 * Valor del select **Persona** en la DB de suplementos. `'Ambas'` es la opción
 * compartida que trae el template; el resto son nombres libres por workspace.
 */
export type SupplementPersona = string;

export interface Supplement {
  notion_id: string;
  name: string;
  category: string[];
  dose: string;
  phase_specific: Phase | 'all';
  /** Etiquetas Notion (Temporada / Season) para filtrar en Stock u otras vistas. */
  temporadaLabels: string[];
  /** Select `Persona` en Notion; determina si el stock vive en SQLite o en el backend compartido. */
  persona: SupplementPersona;
  /**
   * Propiedad `Nutrientes` de Notion (texto libre por toma). `undefined` = la DB
   * no tiene la propiedad (se usa el respaldo local).
   */
  nutrientsText?: string;
  /**
   * Stock compartido leído de las propiedades de la página (solo si la DB las
   * tiene); null = aún sin conteo.
   */
  notionStock?: {
    bottleOpenedAt: Date | null;
    totalPills: number;
    pillsPerDay: number;
    restockFlagged: boolean;
    updatedAt: Date;
  } | null;
}

/** Frecuencia de una tarea del hogar (select `Frecuencia` en Notion). */
export type ChoreFrequency = 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'cada_n_dias';

/** Tarea del hogar (DB «Tareas del hogar» en Notion). */
export interface Chore {
  notion_id: string;
  name: string;
  frequency: ChoreFrequency;
  /** Solo para `cada_n_dias` (propiedad `Cada (días)`). */
  everyNDays: number | null;
  /** Días fijos de la semana (0 = domingo … 6 = sábado); vacío = por intervalo. */
  weekdays: number[];
  /** Select `Persona`; compartida o vacía = cualquiera del hogar. */
  persona: string;
  /** Última vez hecha (`YYYY-MM-DD`, día civil local) o null. */
  lastDone: string | null;
  /** Quién la marcó la última vez (texto libre). */
  doneBy: string;
  /** Notas cortas opcionales (propiedad `Notas`). */
  notes: string;
}

/** Persona detectada en el template de Notion (orden = tabla de Fases, luego select Persona). */
export interface DetectedPersona {
  label: string;
  tracksCycle: boolean;
}

/** Té recomendado por fase del ciclo (BD de Tés en Notion; sin caché local). */
export interface Tea {
  notion_id: string;
  name: string;
  comprovable_benefits: string[];
  holistic_benefits: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Local DB types (kept for existing app screens/hooks)
// ─────────────────────────────────────────────────────────────────────────────

export type CyclePhase = 'menstrual' | 'folicular' | 'ovulacion' | 'lutea';

export interface LocalSupplement {
  id: number;
  name: string;
  dose: string;
  unit: string;
  phases: CyclePhase[];
  notionId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLog {
  id: number;
  user: User;
  supplementId: number;
  date: string; // YYYY-MM-DD
  taken: boolean;
  notes: string | null;
  createdAt: string;
}

export interface StockEntry {
  id: number;
  supplementId: number;
  quantity: number;
  unit: string;
  lastUpdated: string;
  bottleOpenedAt: string | null;
  totalPills: number | null;
  pillsPerDay: number | null;
  restockFlagged: boolean;
}

export interface LocalPhase {
  id: number;
  name: CyclePhase;
  startDate: string;
  endDate: string;
  notionPageId: string | null;
}

/** De dónde sale la fase/día del ciclo en la última carga (ver docs/specs/healthkit-cycle-sync.md). */
export type CycleDataSource = 'healthkit' | 'device' | 'notion';

export interface HealthKitDiagnostics {
  nativeModuleLoaded: boolean;
  healthStoreAvailable: boolean;
}

/** Contexto de ciclo leído en Salud (no sustituye el perfil Diana/Estefanía en la app). */
export type HealthKitLifecycleContext = 'none' | 'pregnancy' | 'lactation' | 'contraceptive';

/** Señales opcionales de Ciclo menstrual / fertilidad desde HealthKit (ver `fetchHealthKitCycleSignals`). */
export interface HealthKitCycleSignals {
  lastPeriodStart: Date | null;
  ovulationSignalDate: Date | null;
  peakFertileMucusDate: Date | null;
  bbtRiseAnchorDate: Date | null;
  irregularCycleReported: boolean;
  lifecycleContext: HealthKitLifecycleContext;
  /** Mediana de deltas entre inicios de período en Salud; null = usar 28. */
  estimatedCycleLengthDays: number | null;
  /** Cuántos ciclos (deltas válidos) respaldan la estimación. */
  estimatedCycleLengthCyclesUsed: number | null;
}

/** Fila de la pestaña Salud (lecturas HealthKit visibles para la usuaria). */
export type HealthKitDataScreenRowKind =
  | 'info'
  | 'permission'
  | 'no_data'
  | 'value'
  | 'error'
  | 'unavailable';

export interface HealthKitDataScreenRow {
  id: string;
  label: string;
  kind: HealthKitDataScreenRowKind;
  text: string;
  hint?: string;
}

export interface HealthKitDataScreenSnapshot {
  rows: HealthKitDataScreenRow[];
  refreshedAt: string;
}

export interface HealthData {
  cyclePhase: CyclePhase | null;
  cycleDay: number | null;
  lastPeriodStart: Date | null;
  /** Apple Salud reportó irregularidad de ciclo reciente (tipos iOS 16+). */
  healthKitIrregularCycleHint: boolean;
  /** Embarazo, lactancia o anticonceptivo reciente en Salud; la app no escribe fase en Notion automáticamente si es embarazo/lactancia. */
  healthKitLifecycleContext: HealthKitLifecycleContext;
}
