import { useCallback, useEffect, useMemo, useState } from 'react';
import { eq } from 'drizzle-orm';
import { getSharedStock } from '../api/sharedStock';
import type { SharedStock } from '../api/sharedStock';
import { db, stock } from '../db';
import type { StockEntry, Supplement } from '../types';
import { reportErrorToSentry } from '../utils/observability';

export function useStock() {
  const [data, setData] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await db.select().from(stock);
      setData(rows as StockEntry[]);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      reportErrorToSentry(err, {
        domain: 'sqlite',
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateQuantity = useCallback(
    async (supplementId: number, quantity: number) => {
      const existing = data.find((s) => s.supplementId === supplementId);
      const now = new Date().toISOString();

      if (existing) {
        await db
          .update(stock)
          .set({ quantity, lastUpdated: now })
          .where(eq(stock.supplementId, supplementId));
      } else {
        await db.insert(stock).values({
          supplementId,
          quantity,
          unit: 'unidades',
          lastUpdated: now,
          restockFlagged: false,
        });
      }
      await load();
    },
    [data, load]
  );

  const decrementStock = useCallback(
    async (supplementId: number, amount = 1) => {
      const entry = data.find((s) => s.supplementId === supplementId);
      if (!entry) return;
      await updateQuantity(supplementId, Math.max(0, entry.quantity - amount));
    },
    [data, updateQuantity]
  );

  const getLowStock = useCallback(
    (threshold = 7) => data.filter((s) => s.quantity <= threshold),
    [data]
  );

  const updateBottle = useCallback(
    async (
      supplementId: number,
      bottleOpenedAt: string,
      totalPills: number,
      pillsPerDay: number,
      opts?: { resetRestockFlag?: boolean }
    ) => {
      const existing = data.find((s) => s.supplementId === supplementId);
      const now = new Date().toISOString();

      if (existing) {
        await db
          .update(stock)
          .set({
            bottleOpenedAt,
            totalPills,
            pillsPerDay,
            lastUpdated: now,
            ...(opts?.resetRestockFlag ? { restockFlagged: false } : {}),
          })
          .where(eq(stock.supplementId, supplementId));
      } else {
        await db.insert(stock).values({
          supplementId,
          quantity: 0,
          unit: 'pastillas',
          lastUpdated: now,
          bottleOpenedAt,
          totalPills,
          pillsPerDay,
          restockFlagged: false,
        });
      }
      await load();
    },
    [data, load]
  );

  const setRestockFlagged = useCallback(
    async (supplementId: number, flagged: boolean) => {
      await db
        .update(stock)
        .set({ restockFlagged: flagged, lastUpdated: new Date().toISOString() })
        .where(eq(stock.supplementId, supplementId));
      await load();
    },
    [load]
  );

  return {
    data,
    loading,
    error,
    updateQuantity,
    decrementStock,
    getLowStock,
    updateBottle,
    setRestockFlagged,
    refetch: load,
  };
}

/** Stock compartido (Persona = Ambas) desde el backend MongoDB. */
export function useSharedStockMap(supplements: Supplement[]) {
  const [sharedByNotionId, setSharedByNotionId] = useState<Record<string, SharedStock | null>>({});
  const [loading, setLoading] = useState(true);

  const ambasKey = useMemo(
    () =>
      supplements
        .filter((s) => s.persona === 'Ambas')
        .map((s) => s.notion_id)
        .sort()
        .join('|'),
    [supplements]
  );

  useEffect(() => {
    const ids = ambasKey
      ? ambasKey.split('|').filter(Boolean)
      : [];
    if (ids.length === 0) {
      setSharedByNotionId({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const pairs = await Promise.all(
        ids.map(async (id) => [id, await getSharedStock(id)] as const)
      );
      if (!cancelled) {
        setSharedByNotionId(Object.fromEntries(pairs));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ambasKey]);

  const refetchShared = useCallback(async () => {
    const ids = supplements.filter((s) => s.persona === 'Ambas').map((s) => s.notion_id);
    if (ids.length === 0) {
      setSharedByNotionId({});
      return;
    }
    const pairs = await Promise.all(
      ids.map(async (id) => [id, await getSharedStock(id)] as const)
    );
    setSharedByNotionId(Object.fromEntries(pairs));
  }, [supplements]);

  return { sharedByNotionId, loading, refetchShared };
}
