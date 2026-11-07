/**
 * Fecha de último periodo en el llavero (no en SQLite/backup) + migración
 * desde la tabla `cycle_states` de builds anteriores.
 */
import * as SecureStore from 'expo-secure-store';
import { loadLastPeriodStart, saveLastPeriodStart } from './cycleStateStore';

const mockSecureStore = new Map<string, string>();
let mockLegacyRows: { user: string; lastPeriodStart: string | null }[] = [];
const mockDelete = jest.fn();

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
  getItemAsync: jest.fn(async (k: string) => mockSecureStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockSecureStore.set(k, v);
  }),
}));

jest.mock('../db', () => ({
  cycleStates: { user: 'user' },
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => mockLegacyRows }),
      }),
    }),
    delete: () => ({
      where: async () => {
        mockDelete();
        mockLegacyRows = [];
      },
    }),
  },
}));

beforeEach(() => {
  mockSecureStore.clear();
  mockLegacyRows = [];
  mockDelete.mockClear();
  jest.mocked(SecureStore.setItemAsync).mockClear();
});

describe('cycleStateStore', () => {
  it('guarda en el llavero con accesibilidad solo-este-dispositivo', async () => {
    await saveLastPeriodStart('profile_1', new Date('2026-10-20T06:00:00.000Z'));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'cycle_last_period_start_profile_1',
      '2026-10-20T06:00:00.000Z',
      { keychainAccessible: 'afterFirstUnlockThisDeviceOnly' },
    );
    expect(await loadLastPeriodStart('profile_1')).toEqual(new Date('2026-10-20T06:00:00.000Z'));
  });

  it('sin valor en llavero ni SQLite devuelve null', async () => {
    expect(await loadLastPeriodStart('profile_2')).toBeNull();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('migra la fila legacy de SQLite al llavero y la borra', async () => {
    mockLegacyRows = [{ user: 'profile_1', lastPeriodStart: '2026-09-01T06:00:00.000Z' }];
    const d = await loadLastPeriodStart('profile_1');
    expect(d).toEqual(new Date('2026-09-01T06:00:00.000Z'));
    expect(mockSecureStore.get('cycle_last_period_start_profile_1')).toBe(
      '2026-09-01T06:00:00.000Z',
    );
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('si ya hay valor en el llavero, gana sobre la fila legacy (que igual se borra)', async () => {
    mockSecureStore.set('cycle_last_period_start_profile_1', '2026-10-20T06:00:00.000Z');
    mockLegacyRows = [{ user: 'profile_1', lastPeriodStart: '2026-09-01T06:00:00.000Z' }];
    expect(await loadLastPeriodStart('profile_1')).toEqual(new Date('2026-10-20T06:00:00.000Z'));
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('fila legacy con fecha inválida: se borra y devuelve null', async () => {
    mockLegacyRows = [{ user: 'profile_1', lastPeriodStart: 'no-es-fecha' }];
    expect(await loadLastPeriodStart('profile_1')).toBeNull();
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});
