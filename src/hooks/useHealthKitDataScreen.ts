import { useCallback } from 'react';
import { getHealthKitDataScreenSnapshot } from '../api/healthkit';
import type { HealthKitDataScreenSnapshot } from '../types';
import { useCache } from './useCache';

const TTL_MS = 60 * 1000;

/**
 * Carga datos para la pestaña Salud (HealthKit): filas con valor, sin datos, permiso o error.
 */
export function useHealthKitDataScreen() {
  const fetcher = useCallback(async (): Promise<HealthKitDataScreenSnapshot> => {
    return getHealthKitDataScreenSnapshot();
  }, []);

  return useCache<HealthKitDataScreenSnapshot>('healthkit_data_screen', fetcher, TTL_MS);
}
