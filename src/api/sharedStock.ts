import { BACKEND_API_KEY } from '@env';
import type { StockEntry } from '../types';

function sharedStockBackendBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').trim().replace(/\/$/, '');
}

export interface SharedStock {
  notionId: string;
  bottleOpenedAt: Date | null;
  totalPills: number;
  pillsPerDay: number;
  restockFlagged: boolean;
  updatedAt: Date;
}

export type SharedStockUpdate = Partial<Omit<SharedStock, 'notionId' | 'updatedAt'>>;

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': BACKEND_API_KEY ?? '',
  };
}

/** Normaliza `SharedStock` tras `JSON.parse` (AsyncStorage) o datos ya en memoria. */
export function reviveSharedStockMapFromCache(
  raw: Record<string, SharedStock | null>
): Record<string, SharedStock | null> {
  const out: Record<string, SharedStock | null> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) {
      out[k] = null;
      continue;
    }
    if (typeof v !== 'object') {
      out[k] = null;
      continue;
    }
    const o = v as unknown as Record<string, unknown>;
    const notionId = String(o.notionId ?? k);
    const updatedAt = parseDate(o.updatedAt) ?? new Date();
    const bottleOpenedAt = parseDate(o.bottleOpenedAt);
    const totalPills = Number(o.totalPills);
    const pillsPerDay = Number(o.pillsPerDay);
    if (!Number.isFinite(totalPills) || !Number.isFinite(pillsPerDay)) {
      out[k] = null;
      continue;
    }
    out[k] = {
      notionId,
      bottleOpenedAt,
      totalPills,
      pillsPerDay,
      restockFlagged: Boolean(o.restockFlagged),
      updatedAt,
    };
  }
  return out;
}

function parseDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseSharedDoc(raw: unknown): SharedStock | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const notionId = String(o.notionId ?? '');
  if (!notionId) return null;
  const bottleOpenedAt = parseDate(o.bottleOpenedAt);
  const updatedAt = parseDate(o.updatedAt);
  const totalPills = Number(o.totalPills);
  const pillsPerDay = Number(o.pillsPerDay);
  if (!Number.isFinite(totalPills) || !Number.isFinite(pillsPerDay)) return null;
  return {
    notionId,
    bottleOpenedAt,
    totalPills,
    pillsPerDay,
    restockFlagged: Boolean(o.restockFlagged),
    updatedAt: updatedAt ?? new Date(),
  };
}

/** Convierte respuesta del backend a `StockEntry` mínimo para `calcDays` y banner de restock. */
export function sharedStockToStockEntry(shared: SharedStock, supplementId: number): StockEntry {
  return {
    id: 0,
    supplementId,
    quantity: 0,
    unit: 'pastillas',
    lastUpdated: shared.updatedAt.toISOString(),
    bottleOpenedAt: shared.bottleOpenedAt ? shared.bottleOpenedAt.toISOString().slice(0, 10) : null,
    totalPills: shared.totalPills,
    pillsPerDay: shared.pillsPerDay,
    restockFlagged: shared.restockFlagged,
  };
}

export async function getSharedStock(notionId: string): Promise<SharedStock | null> {
  const key = BACKEND_API_KEY?.trim();
  if (!key) {
    console.warn('getSharedStock: missing BACKEND_API_KEY');
    return null;
  }
  const base = sharedStockBackendBaseUrl();
  if (!base) {
    console.warn('getSharedStock: missing EXPO_PUBLIC_BACKEND_URL');
    return null;
  }
  const url = `${base}/stock/${encodeURIComponent(notionId)}`;
  try {
    const res = await fetch(url, { headers: headers() });
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.text();
      console.warn('getSharedStock failed', res.status, body);
      return null;
    }
    const json: unknown = await res.json();
    const parsed = parseSharedDoc(json);
    if (!parsed) console.warn('getSharedStock: invalid JSON shape', notionId);
    return parsed;
  } catch (e) {
    console.warn('getSharedStock network error', notionId, e);
    return null;
  }
}

function serializeBottleOpenedAt(value: Date | null | undefined): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value.toISOString();
}

export async function updateSharedStock(
  notionId: string,
  data: SharedStockUpdate
): Promise<void> {
  const key = BACKEND_API_KEY?.trim();
  if (!key) {
    throw new Error('Missing BACKEND_API_KEY');
  }
  const base = sharedStockBackendBaseUrl();
  if (!base) {
    throw new Error('Missing EXPO_PUBLIC_BACKEND_URL');
  }
  const body: Record<string, unknown> = {};
  if (data.bottleOpenedAt !== undefined) {
    body.bottleOpenedAt = serializeBottleOpenedAt(data.bottleOpenedAt);
  }
  if (data.totalPills !== undefined) body.totalPills = data.totalPills;
  if (data.pillsPerDay !== undefined) body.pillsPerDay = data.pillsPerDay;
  if (data.restockFlagged !== undefined) body.restockFlagged = data.restockFlagged;

  const url = `${base}/stock/${encodeURIComponent(notionId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`updateSharedStock failed ${res.status}: ${text}`);
  }
}
