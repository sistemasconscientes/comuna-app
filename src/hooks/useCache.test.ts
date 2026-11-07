/**
 * `persist: false` mantiene la caché solo en memoria (datos de Apple Salud
 * fuera de AsyncStorage / backup de iCloud) y borra el residuo de builds viejos.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import { __clearMemoryCacheForTests, useCache } from './useCache';

beforeEach(async () => {
  __clearMemoryCacheForTests();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('useCache', () => {
  it('por defecto persiste en AsyncStorage', async () => {
    const { result } = await renderHook(() => useCache('k_disk', async () => ({ n: 1 })));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    expect(await AsyncStorage.getItem('useCache_v1:k_disk')).toContain('"n":1');
  });

  it('persist: false no escribe a disco y borra la clave legacy', async () => {
    await AsyncStorage.setItem(
      'useCache_v1:k_mem',
      JSON.stringify({ value: { hr: 60 }, fetchedAt: Date.now() }),
    );
    jest.mocked(AsyncStorage.setItem).mockClear();
    const { result } = await renderHook(() =>
      useCache('k_mem', async () => ({ hr: 72 }), 60_000, { persist: false }),
    );
    await waitFor(() => expect(result.current.data).toEqual({ hr: 72 }));
    expect(await AsyncStorage.getItem('useCache_v1:k_mem')).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('useCache_v1:k_mem', expect.anything());
  });

  it('persist: false reutiliza la caché en memoria dentro del TTL', async () => {
    const fetcher = jest.fn(async () => ({ hr: 72 }));
    const first = await renderHook(() => useCache('k_mem2', fetcher, 60_000, { persist: false }));
    await waitFor(() => expect(first.result.current.data).toEqual({ hr: 72 }));
    await first.unmount();

    const second = await renderHook(() => useCache('k_mem2', fetcher, 60_000, { persist: false }));
    await waitFor(() => expect(second.result.current.data).toEqual({ hr: 72 }));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
