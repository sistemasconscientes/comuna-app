import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_PREFIX = 'useCache_v1:';

type Envelope<T> = { value: T; fetchedAt: number };

function parseEnvelope<T>(raw: string | null): Envelope<T> | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (
      o &&
      typeof o === 'object' &&
      'value' in o &&
      'fetchedAt' in o &&
      typeof (o as Envelope<T>).fetchedAt === 'number'
    ) {
      return o as Envelope<T>;
    }
  } catch {
    /* ignore corrupt */
  }
  return null;
}

async function persist<T>(key: string, value: T): Promise<void> {
  const envelope: Envelope<T> = { value, fetchedAt: Date.now() };
  await AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(envelope));
}

/**
 * Stale-while-revalidate con AsyncStorage: muestra caché al instante si existe;
 * revalida en background solo si el TTL expiró; `refresh` fuerza fetch (p. ej. pull-to-refresh).
 */
export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 5 * 60 * 1000,
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refreshing: boolean;
  /** Pull-to-refresh o refetch explícito; devuelve una promesa que termina al finalizar el fetch. */
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const prevKeyRef = useRef(key);

  const refresh = useCallback((): Promise<void> => {
    return (async () => {
      setRefreshing(true);
      setError(null);
      try {
        const value = await fetcherRef.current();
        setData(value);
        setError(null);
        await persist(key, value);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setRefreshing(false);
      }
    })();
  }, [key]);

  useEffect(() => {
    let cancelled = false;
    const keySwitched = prevKeyRef.current !== key;
    prevKeyRef.current = key;

    void (async () => {
      if (keySwitched) setData(null);
      setLoading(true);
      setError(null);

      const raw = await AsyncStorage.getItem(STORAGE_PREFIX + key);
      if (cancelled) return;

      const env = parseEnvelope<T>(raw);
      if (env) {
        setData(env.value);
        setLoading(false);
        const stale = Date.now() - env.fetchedAt > ttlMs;
        if (stale) {
          try {
            const value = await fetcherRef.current();
            if (cancelled) return;
            setData(value);
            setError(null);
            await persist(key, value);
          } catch (e) {
            if (!cancelled) {
              setError(e instanceof Error ? e : new Error(String(e)));
            }
          }
        }
        return;
      }

      try {
        const value = await fetcherRef.current();
        if (cancelled) return;
        setData(value);
        setError(null);
        await persist(key, value);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, ttlMs]);

  return { data, loading, error, refreshing, refresh };
}
