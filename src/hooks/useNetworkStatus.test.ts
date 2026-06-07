import { deriveIsOffline } from './useNetworkStatus';

describe('deriveIsOffline', () => {
  it('offline cuando isConnected es false', () => {
    expect(deriveIsOffline({ isConnected: false, isInternetReachable: true })).toBe(true);
  });

  it('offline cuando isInternetReachable es false', () => {
    expect(deriveIsOffline({ isConnected: true, isInternetReachable: false })).toBe(true);
  });

  it('online cuando ambos son true', () => {
    expect(deriveIsOffline({ isConnected: true, isInternetReachable: true })).toBe(false);
  });

  it('asume online si el estado es desconocido (evita falsos positivos al arrancar)', () => {
    expect(deriveIsOffline({})).toBe(false);
    expect(deriveIsOffline({ isConnected: undefined, isInternetReachable: undefined })).toBe(false);
  });
});
