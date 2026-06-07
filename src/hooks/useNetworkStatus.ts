import { useNetworkState } from 'expo-network';

type NetworkLike = { isConnected?: boolean; isInternetReachable?: boolean };

/**
 * Offline solo cuando hay señal CLARA de no-conexión. Si el estado es desconocido
 * (campos `undefined`, p. ej. al arrancar), se asume online para evitar mostrar
 * "sin conexión" en falso.
 */
export function deriveIsOffline(state: NetworkLike): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

/** Hook reactivo: `true` mientras el dispositivo esté sin conexión. */
export function useIsOffline(): boolean {
  return deriveIsOffline(useNetworkState());
}
