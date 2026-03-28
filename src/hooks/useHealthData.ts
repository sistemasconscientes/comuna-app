import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { getCurrentPhase, updatePhase } from '../api/notion';
import {
  EMPTY_HEALTH_KIT_CYCLE_SIGNALS,
  fetchHealthKitCycleSignals,
  getHealthKitDiagnostics,
  resetHealthKitInitForQA,
} from '../api/healthkit';
import { db, cycleStates } from '../db';
import { cyclePhaseToPhase, normalizePhase, phaseToCyclePhase } from '../utils/phaseUtils';
import {
  addLocalCalendarDays,
  DEFAULT_CYCLE_LENGTH_DAYS,
  getCurrentCycleInfoWithHealthKitRefinements,
} from '../utils/phaseCalculator';
import type { CycleDataSource, HealthData, HealthKitCycleSignals, HealthKitDiagnostics } from '../types';
import { NOTION_SKIP_PHASE_WRITE } from '@env';
import { reportErrorToSentry } from '../utils/observability';

/** Solo en __DEV__: si NOTION_SKIP_PHASE_WRITE es truthy, no escribir fase en Notion (QA sin pisar filas reales). */
function isDevSkipNotionPhaseWrite(): boolean {
  if (!__DEV__) return false;
  const v = NOTION_SKIP_PHASE_WRITE?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function hkContextFields(h: HealthKitCycleSignals) {
  return {
    healthKitIrregularCycleHint: h.irregularCycleReported,
    healthKitLifecycleContext: h.lifecycleContext,
  };
}

export type UseHealthDataResult = HealthData & {
  loading: boolean;
  error: Error | null;
  cycleDataSource: CycleDataSource;
  healthKitDiagnostics: HealthKitDiagnostics | null;
  refetch: () => void;
};

async function loadNotionPhaseOnly(
  user: 'diana' | 'estefania',
): Promise<Pick<HealthData, 'cyclePhase' | 'cycleDay' | 'lastPeriodStart'>> {
  const { phase } = await getCurrentPhase(user);
  const normalized = normalizePhase(phase);
  return {
    cyclePhase: normalized && normalized !== 'all' ? phaseToCyclePhase(normalized) : null,
    cycleDay: null,
    lastPeriodStart: null,
  };
}

export function useHealthData(user: 'diana' | 'estefania'): UseHealthDataResult {
  const [state, setState] = useState<HealthData>({
    cyclePhase: null,
    cycleDay: null,
    lastPeriodStart: null,
    healthKitIrregularCycleHint: false,
    healthKitLifecycleContext: 'none',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cycleDataSource, setCycleDataSource] = useState<CycleDataSource>('notion');
  const [healthKitDiagnostics, setHealthKitDiagnostics] = useState<HealthKitDiagnostics | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refetch = useCallback(() => {
    resetHealthKitInitForQA();
    setRefreshToken((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function upsertLastPeriodStart(start: Date) {
      const now = new Date().toISOString();
      const iso = start.toISOString();

      const existing = await db.select().from(cycleStates).where(eq(cycleStates.user, user)).limit(1);

      if (existing.length) {
        await db
          .update(cycleStates)
          .set({ lastPeriodStart: iso, updatedAt: now })
          .where(eq(cycleStates.user, user));
      } else {
        await db.insert(cycleStates).values({ user, lastPeriodStart: iso, updatedAt: now });
      }
    }

    async function loadLastPeriodStartFromDb(): Promise<Date | null> {
      const rows = await db.select().from(cycleStates).where(eq(cycleStates.user, user)).limit(1);
      const raw = rows[0]?.lastPeriodStart;
      if (!raw) return null;

      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return null;
      return d;
    }

    async function fetchHealthData() {
      setLoading(true);
      setError(null);

      const notionUser = user;
      let source: CycleDataSource = 'notion';
      let hkSignals: HealthKitCycleSignals = { ...EMPTY_HEALTH_KIT_CYCLE_SIGNALS };

      try {
        const lastFromDb = await loadLastPeriodStartFromDb();
        const isIos = Platform.OS === 'ios';

        if (isIos) {
          const diag = await getHealthKitDiagnostics();
          if (!cancelled) {
            setHealthKitDiagnostics(diag);
          }

          try {
            hkSignals = await fetchHealthKitCycleSignals();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            reportErrorToSentry(err, {
              domain: 'healthkit',
              message: msg,
              user,
            });
            hkSignals = { ...EMPTY_HEALTH_KIT_CYCLE_SIGNALS };
          }
        } else if (!cancelled) {
          setHealthKitDiagnostics(null);
        }

        const refinements = {
          ovulationSignalDate: hkSignals.ovulationSignalDate,
          peakFertileMucusDate: hkSignals.peakFertileMucusDate,
          bbtRiseAnchorDate: hkSignals.bbtRiseAnchorDate,
        };

        let lastPeriod: Date | null = null;

        if (isIos && hkSignals.lastPeriodStart) {
          lastPeriod = hkSignals.lastPeriodStart;
          source = 'healthkit';
          await upsertLastPeriodStart(lastPeriod);
        } else if (lastFromDb) {
          lastPeriod = lastFromDb;
          source = 'sqlite';
        }

        if (lastPeriod) {
          const { phase, day } = getCurrentCycleInfoWithHealthKitRefinements(lastPeriod, refinements);
          if (!cancelled) {
            setState({
              cyclePhase: phase,
              cycleDay: day,
              lastPeriodStart: lastPeriod,
              ...hkContextFields(hkSignals),
            });
          }

          if (
            isIos &&
            source === 'healthkit' &&
            lastPeriod != null &&
            hkSignals.lifecycleContext !== 'pregnancy' &&
            hkSignals.lifecycleContext !== 'lactation'
          ) {
            try {
              const nextCycleDate = addLocalCalendarDays(lastPeriod, DEFAULT_CYCLE_LENGTH_DAYS);
              const notionRow = await getCurrentPhase(notionUser);
              if (!cancelled) {
                const notionNorm = normalizePhase(notionRow.phase);
                const hkNorm = normalizePhase(cyclePhaseToPhase(phase));
                const comparable =
                  notionNorm != null &&
                  notionNorm !== 'all' &&
                  hkNorm != null &&
                  hkNorm !== 'all';
                if (comparable && notionNorm !== hkNorm) {
                  if (!isDevSkipNotionPhaseWrite()) {
                    await updatePhase(notionUser, phase, nextCycleDate);
                  }
                }
              }
            } catch (notionSyncErr) {
              const msg =
                notionSyncErr instanceof Error ? notionSyncErr.message : String(notionSyncErr);
              reportErrorToSentry(notionSyncErr, {
                domain: 'health_data',
                message: msg,
                user: notionUser,
              });
            }
          }
        } else {
          const notion = await loadNotionPhaseOnly(notionUser);
          if (!cancelled) {
            setState({
              ...notion,
              ...hkContextFields(hkSignals),
            });
          }
        }

        if (!cancelled) {
          setCycleDataSource(source);
        }
      } catch (e) {
        if (!cancelled) {
          const err = e instanceof Error ? e : new Error(String(e));
          setError(err);
          reportErrorToSentry(err, {
            domain: 'health_data',
            message: err.message,
            user,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHealthData();

    return () => {
      cancelled = true;
    };
  }, [user, refreshToken]);

  return {
    ...state,
    loading,
    error,
    cycleDataSource,
    healthKitDiagnostics,
    refetch,
  };
}
