// ─────────────────────────────────────────────────────────────────────────────
// Notion-facing types (as per product spec)
// ─────────────────────────────────────────────────────────────────────────────

export type Phase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea';

export interface Supplement {
  notion_id: string;
  name: string;
  category: string[];
  dose: string;
  phase_specific: Phase | 'all';
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
}

export interface LocalPhase {
  id: number;
  name: CyclePhase;
  startDate: string;
  endDate: string;
  notionPageId: string | null;
}

export interface HealthData {
  cyclePhase: CyclePhase | null;
  cycleDay: number | null;
  lastPeriodStart: Date | null;
}
