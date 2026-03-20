import { useCallback, useEffect, useState } from 'react';
import { usePostHog } from 'posthog-react-native';
import { eq } from 'drizzle-orm';
import { db, stock } from '../db';
import type { StockEntry } from '../types';

export function useStock() {
  const posthog = usePostHog();
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
      posthog?.capture('stock_load_failed', {
        domain: 'sqlite',
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, [posthog]);

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
      pillsPerDay: number
    ) => {
      const existing = data.find((s) => s.supplementId === supplementId);
      const now = new Date().toISOString();

      if (existing) {
        await db
          .update(stock)
          .set({ bottleOpenedAt, totalPills, pillsPerDay, lastUpdated: now })
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
        });
      }
      await load();
    },
    [data, load]
  );

  return { data, loading, error, updateQuantity, decrementStock, getLowStock, updateBottle, refetch: load };
}
