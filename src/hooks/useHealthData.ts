import { useCallback, useEffect, useState } from 'react';
import { usePostHog } from 'posthog-react-native';
import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { getCurrentPhase, updatePhase } from '../api/notion';
import {
  getLastMenstruation,
  getHealthKitDiagnostics,
  resetHealthKitInitForQA,
} from '../api/healthkit';
import { db, cycleStates } from '../db';
import { cyclePhaseToPhase, normalizePhase, phaseToCyclePhase } from '../utils/phaseUtils';
import {
  addLocalCalendarDays,
  DEFAULT_CYCLE_LENGTH_DAYS,
  getCurrentCycleInfo,
} from '../utils/phaseCalculator';
import type { CycleDataSource, HealthData, HealthKitDiagnostics } from '../types';
import { NOTION_SKIP_PHASE_WRITE } from '@env';

/** Solo en __DEV__: si NOTION_SKIP_PHASE_WRITE es truthy, no escribir fase en Notion (QA sin pisar filas reales). */
function isDevSkipNotionPhaseWrite(): boolean {
  if (!__DEV__) return false;
  const v = NOTION_SKIP_PHASE_WRITE?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
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
  const posthog = usePostHog();
  const [state, setState] = useState<HealthData>({
    cyclePhase: null,
    cycleDay: null,
    lastPeriodStart: null,
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

      try {
        const lastFromDb = await loadLastPeriodStartFromDb();
        if (lastFromDb) {
          source = 'sqlite';
        }

        if (!cancelled && lastFromDb) {
          const { phase, day } = getCurrentCycleInfo(lastFromDb);
          setState({ cyclePhase: phase, cycleDay: day, lastPeriodStart: lastFromDb });
        }

        const isIos = Platform.OS === 'ios';

        if (isIos) {
          const diag = await getHealthKitDiagnostics();
          if (!cancelled) {
            setHealthKitDiagnostics(diag);
          }

          try {
            const lastFromHealthKit = await getLastMenstruation();
            if (!cancelled && lastFromHealthKit) {
              source = 'healthkit';
              await upsertLastPeriodStart(lastFromHealthKit);
              const { phase, day } = getCurrentCycleInfo(lastFromHealthKit);
              setState({ cyclePhase: phase, cycleDay: day, lastPeriodStart: lastFromHealthKit });
              if (__DEV__) {
                console.warn(
                  '[useHealthData] Último inicio de menstruación (HealthKit):',
                  lastFromHealthKit.toISOString(),
                  '→ fase',
                  phase,
                  'día',
                  day,
                );
              }

              const hkSample = lastFromHealthKit;
              if (hkSample != null) {
                try {
                  const nextCycleDate = addLocalCalendarDays(
                    hkSample,
                    DEFAULT_CYCLE_LENGTH_DAYS,
                  );
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
                      if (isDevSkipNotionPhaseWrite()) {
                        console.warn(
                          '[useHealthData] NOTION_SKIP_PHASE_WRITE: omitiendo updatePhase (dev)',
                          { user: notionUser, notionNorm, hkNorm },
                        );
                      } else {
                        await updatePhase(notionUser, phase, nextCycleDate);
                      }
                    }
                  }
                } catch (notionSyncErr) {
                  console.warn('[useHealthData] Notion sync tras HealthKit:', notionSyncErr);
                  const msg =
                    notionSyncErr instanceof Error ? notionSyncErr.message : String(notionSyncErr);
                  posthog?.capture('health_data_notion_sync_failed', {
                    domain: 'health_data',
                    message: msg,
                    user: notionUser,
                  });
                }
              }
            } else if (!cancelled && !lastFromDb) {
              const notion = await loadNotionPhaseOnly(notionUser);
              setState(notion);
            }
          } catch (err) {
            console.warn('HealthKit error:', err);
            const msg = err instanceof Error ? err.message : String(err);
            posthog?.capture('healthkit_last_menstruation_failed', {
              domain: 'healthkit',
              message: msg,
              user,
            });
            if (!cancelled && !lastFromDb) {
              const notion = await loadNotionPhaseOnly(notionUser);
              setState(notion);
            }
          }
        } else {
          if (!cancelled) {
            setHealthKitDiagnostics(null);
          }
          if (!cancelled && !lastFromDb) {
            const notion = await loadNotionPhaseOnly(notionUser);
            setState(notion);
          }
        }

        if (!cancelled) {
          setCycleDataSource(source);
        }
      } catch (e) {
        if (!cancelled) {
          const err = e instanceof Error ? e : new Error(String(e));
          setError(err);
          posthog?.capture('health_data_load_failed', {
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
  }, [user, posthog, refreshToken]);

  return {
    ...state,
    loading,
    error,
    cycleDataSource,
    healthKitDiagnostics,
    refetch,
  };
}
