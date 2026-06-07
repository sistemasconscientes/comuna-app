import { useCallback, useEffect, useState } from 'react';
import { getTeasForPhase } from '../api/notion';
import type { Phase, Tea } from '../types';
import { reportErrorToSentry } from '../utils/observability';

/**
 * Tés recomendados para la fase del ciclo (directo de Notion, sin caché local).
 * Expone rotación local con `nextTea` para mostrar uno a la vez.
 */
export function useTeas(phase: Phase) {
  const [teas, setTeas] = useState<Tea[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getTeasForPhase(phase);
        if (!cancelled) {
          setTeas(data);
          setCurrentIndex(0);
        }
      } catch (e) {
        if (!cancelled) {
          const err = e instanceof Error ? e : new Error(String(e));
          setError(err);
          reportErrorToSentry(err, {
            domain: 'notion',
            message: err.message,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const nextTea = useCallback(() => {
    setCurrentIndex((i) => (teas.length > 1 ? (i + 1) % teas.length : i));
  }, [teas.length]);

  return { teas, currentIndex, loading, error, nextTea };
}
