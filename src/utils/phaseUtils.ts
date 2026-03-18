import type { Phase, CyclePhase } from '../types';

export function normalizePhase(input: string): Phase | 'all' | null {
  const v = input
    .trim()
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/[\u{1F000}-\u{1F02F}]/gu, '')
    .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, '')
    .replace(/[\u{1F100}-\u{1F1FF}]/gu, '')
    .replace(/[\u{1F200}-\u{1F2FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .trim();

  if (!v) return null;
  if (v === 'all' || v === 'todas' || v === 'ambas' || v === 'siempre') return 'all';
  if (v === 'menstrual') return 'menstrual';
  if (v === 'folicular' || v === 'follicular') return 'folicular';
  if (v === 'ovulatoria' || v === 'ovulacion' || v === 'ovulación' || v === 'ovulacion/ovulacion') return 'ovulatoria';
  if (v === 'lutea' || v === 'lútea' || v === 'luteal') return 'lutea';
  return null;
}

export function phaseToCyclePhase(phase: Phase): CyclePhase {
  if (phase === 'ovulatoria') return 'ovulacion';
  return phase;
}