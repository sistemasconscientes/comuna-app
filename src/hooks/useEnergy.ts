import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { fetchSleepIntervals } from '../api/healthkit';
import { isDemoMode } from '../config/notionSettings';
import type { CyclePhase } from '../types';
import {
  estimateEnergy,
  groupSleepByNight,
  todayNightKey,
  type EnergyEstimate,
} from '../utils/energy';
import { reportErrorToSentry } from '../utils/observability';

const HOUR = 60 * 60 * 1000;

/** Modo demo (App Review / sin Salud): una semana de sueño de ejemplo con noche corta. */
function demoNights(todayKey: string): { night: string; asleepMs: number }[] {
  const out = [{ night: todayKey, asleepMs: 6.2 * HOUR }];
  const d = new Date();
  for (let i = 1; i <= 7; i++) {
    d.setDate(d.getDate() - 1);
    const key = todayNightKey(d);
    out.push({ night: key, asleepMs: (7 + (i % 3) * 0.3) * HOUR });
  }
  return out;
}

/**
 * Energía disponible de hoy según el sueño registrado en Apple Salud de este
 * teléfono (+ matiz de fase si el perfil sigue ciclo). `estimate = null` si no
 * hay sueño de anoche.
 */
export function useEnergy(phase: CyclePhase | null, calendarDayKey: string) {
  const [estimate, setEstimate] = useState<EnergyEstimate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const todayKey = todayNightKey();
      try {
        const nights = isDemoMode()
          ? demoNights(todayKey)
          : Platform.OS === 'ios'
            ? groupSleepByNight(await fetchSleepIntervals())
            : [];
        if (!cancelled) setEstimate(estimateEnergy(nights, todayKey, phase));
      } catch (e) {
        reportErrorToSentry(e, { domain: 'energy' });
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, calendarDayKey]);

  return { estimate, loading };
}
