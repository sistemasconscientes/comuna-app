import { useEffect, useState } from 'react';
import { getCurrentPhase } from '../api/notion';
import { normalizePhase, phaseToCyclePhase } from '../utils/phaseUtils';
import type { HealthData } from '../types';

export function useHealthData(user: 'diana' | 'estefania'): HealthData & { loading: boolean; error: Error | null } {
  const [state, setState] = useState<HealthData>({
    cyclePhase: null,
    cycleDay: null,
    lastPeriodStart: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchHealthData() {
      setLoading(true);
      setError(null);
      try {
        const { phase } = await getCurrentPhase(user);
        const normalized = normalizePhase(phase);
        setState({
          cyclePhase: normalized && normalized !== 'all' ? phaseToCyclePhase(normalized) : null,
          cycleDay: null,
          lastPeriodStart: null,
        });
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
      }
    }

    fetchHealthData();
  }, [user]);

  return { ...state, loading, error };
}
