import { useCallback, useEffect, useState } from 'react';
import { eq, and } from 'drizzle-orm';
import { db, dailyLogs } from '../db';
import type { User } from '../context/UserContext';
import type { DailyLog } from '../types';
import { reportErrorToSentry } from '../utils/observability';

/**
 * Registro de tomas para `date` (YYYY-MM-DD) en calendario local del dispositivo.
 * No usar `toISOString().split('T')[0]` para esta fecha: ver docs/specs/daily-log-local-calendar.md
 */
export function useDailyLog(user: User, date: string) {
  const [data, setData] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await db
        .select()
        .from(dailyLogs)
        .where(and(eq(dailyLogs.date, date), eq(dailyLogs.user, user)));

      const mismatched = rows.filter((r) => r.date !== date);
      if (mismatched.length > 0) {
        reportErrorToSentry(new Error('daily_logs row date mismatch'), {
          domain: 'sqlite',
          message: 'Fila con date distinta al WHERE',
          expected_date: date,
          user,
          bad_count: mismatched.length,
        });
      }
      const sane = rows.filter((r) => r.date === date) as DailyLog[];
      setData(sane);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      reportErrorToSentry(err, {
        domain: 'sqlite',
        message: err.message,
        date,
        user,
      });
    } finally {
      setLoading(false);
    }
  }, [date, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const markTaken = useCallback(
    async (supplementId: number, taken: boolean, notes?: string) => {
      const existing = data.find((l) => l.supplementId === supplementId);
      const now = new Date().toISOString();

      if (existing) {
        await db
          .update(dailyLogs)
          .set({ taken, notes: notes ?? existing.notes })
          .where(
            and(
              eq(dailyLogs.supplementId, supplementId),
              eq(dailyLogs.date, date),
              eq(dailyLogs.user, user),
            ),
          );
      } else {
        await db.insert(dailyLogs).values({
          user,
          supplementId,
          date,
          taken,
          notes: notes ?? null,
          createdAt: now,
        });
      }
      await load();
    },
    [data, date, load, user],
  );

  const isTaken = useCallback(
    (supplementId: number) => data.find((l) => l.supplementId === supplementId)?.taken ?? false,
    [data],
  );

  return { data, loading, error, markTaken, isTaken, refetch: load };
}
