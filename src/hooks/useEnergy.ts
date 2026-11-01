import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { fetchSleepIntervals } from '../api/healthkit';
import { isDemoMode } from '../config/notionSettings';
import type { CyclePhase, HealthKitLifecycleContext } from '../types';
import {
  ENERGY_LOOKBACK_NIGHTS,
  estimateEnergy,
  groupSleepByNight,
  nightKeyToDate,
  todayNightKey,
  type EnergyCycleContext,
  type EnergyEstimate,
} from '../utils/energy';
import { getCurrentCycleInfo } from '../utils/phaseCalculator';
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

export interface UseEnergyCycle {
  phase: CyclePhase | null;
  lastPeriodStart: Date | null;
  cycleLengthDays: number;
  lifecycleContext: HealthKitLifecycleContext;
}

/**
 * Energía disponible de hoy según el sueño registrado en Apple Salud de este
 * teléfono, ajustada a la fase si el perfil sigue ciclo (`cycle = null` si no).
 * `estimate = null` si no hay sueño de anoche. `ready = false` mientras la fase
 * aún carga: evita leer el sueño dos veces (sin y con contexto de ciclo).
 */
export function useEnergy(cycle: UseEnergyCycle | null, calendarDayKey: string, ready = true) {
  const [estimate, setEstimate] = useState<EnergyEstimate | null>(null);
  const [loading, setLoading] = useState(true);

  const phase = cycle?.phase ?? null;
  const lastPeriodMs = cycle?.lastPeriodStart?.getTime() ?? null;
  const cycleLength = cycle?.cycleLengthDays ?? null;
  const lifecycle = cycle?.lifecycleContext ?? 'none';

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const todayKey = todayNightKey();
      try {
        const nights = isDemoMode()
          ? demoNights(todayKey)
          : Platform.OS === 'ios'
            ? groupSleepByNight(await fetchSleepIntervals(ENERGY_LOOKBACK_NIGHTS))
            : [];
        let ctx: EnergyCycleContext | null = null;
        if (phase) {
          ctx = {
            phase,
            lifecycleContext: lifecycle,
            ...(lastPeriodMs != null && cycleLength
              ? {
                  phaseOfNight: (night: string) =>
                    getCurrentCycleInfo(
                      new Date(lastPeriodMs),
                      { cycleLength },
                      nightKeyToDate(night),
                    ).phase,
                }
              : {}),
          };
        }
        if (!cancelled) setEstimate(estimateEnergy(nights, todayKey, ctx));
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
  }, [phase, lastPeriodMs, cycleLength, lifecycle, calendarDayKey, ready]);

  return { estimate, loading };
}
