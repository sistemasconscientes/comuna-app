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

export type UseCacheOptions = {
  /**
   * `false` ⇒ caché solo en memoria (dura lo que el proceso). Para datos de
   * Apple Salud: AsyncStorage entra en el backup de iCloud (guideline 5.1.3(ii)).
   */
  persist?: boolean;
};

/** Caché en memoria para las claves con `persist: false`. */
const memoryCache = new Map<string, Envelope<unknown>>();

async function readEnvelope<T>(key: string, toDisk: boolean): Promise<Envelope<T> | null> {
  if (!toDisk) {
    // Builds anteriores guardaban esta clave en disco: borrar el residuo.
    await AsyncStorage.removeItem(STORAGE_PREFIX + key).catch(() => {});
    return (memoryCache.get(key) as Envelope<T> | undefined) ?? null;
  }
  return parseEnvelope<T>(await AsyncStorage.getItem(STORAGE_PREFIX + key));
}

async function persist<T>(key: string, value: T, toDisk: boolean): Promise<void> {
  const envelope: Envelope<T> = { value, fetchedAt: Date.now() };
  if (!toDisk) {
    memoryCache.set(key, envelope);
    return;
  }
  await AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(envelope));
}

/** Solo tests: vacía la caché en memoria. */
export function __clearMemoryCacheForTests(): void {
  memoryCache.clear();
}

/**
 * Stale-while-revalidate con AsyncStorage (o memoria si `persist: false`):
 * muestra caché al instante si existe; revalida en background solo si el TTL
 * expiró; `refresh` fuerza fetch (p. ej. pull-to-refresh).
 */
export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 5 * 60 * 1000,
  options?: UseCacheOptions,
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
  const toDisk = options?.persist !== false;

  const refresh = useCallback((): Promise<void> => {
    return (async () => {
      setRefreshing(true);
      setError(null);
      try {
        const value = await fetcherRef.current();
        setData(value);
        setError(null);
        await persist(key, value, toDisk);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setRefreshing(false);
      }
    })();
  }, [key, toDisk]);

  useEffect(() => {
    let cancelled = false;
    const keySwitched = prevKeyRef.current !== key;
    prevKeyRef.current = key;

    void (async () => {
      if (keySwitched) setData(null);
      setLoading(true);
      setError(null);

      const env = await readEnvelope<T>(key, toDisk);
      if (cancelled) return;

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
            await persist(key, value, toDisk);
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
        await persist(key, value, toDisk);
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
  }, [key, ttlMs, toDisk]);

  return { data, loading, error, refreshing, refresh };
}
