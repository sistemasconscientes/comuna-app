import { useCallback, useEffect, useState } from 'react';
import { eq, and } from 'drizzle-orm';
import { db, dailyLogs } from '../db';
import type { DailyLog } from '../types';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function useDailyLog(date: string = today()) {
  const [data, setData] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await db
        .select()
        .from(dailyLogs)
        .where(eq(dailyLogs.date, date));
      setData(rows as DailyLog[]);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const markTaken = useCallback(
    async (supplementId: number, taken: boolean, notes?: string) => {
      const existing = data.find((l) => l.supplementId === supplementId);
      const now = new Date().toISOString();

      if (existing) {
        await db
          .update(dailyLogs)
          .set({ taken, notes: notes ?? existing.notes })
          .where(
            and(eq(dailyLogs.supplementId, supplementId), eq(dailyLogs.date, date))
          );
      } else {
        await db.insert(dailyLogs).values({
          supplementId,
          date,
          taken,
          notes: notes ?? null,
          createdAt: now,
        });
      }
      await load();
    },
    [data, date, load]
  );

  const isTaken = useCallback(
    (supplementId: number) =>
      data.find((l) => l.supplementId === supplementId)?.taken ?? false,
    [data]
  );

  return { data, loading, error, markTaken, isTaken, refetch: load };
}
