import { useEffect, useState } from 'react';
import { inArray } from 'drizzle-orm';
import { getSupplements } from '../api/notion';
import type { Supplement } from '../types';
import { db, supplements as supplementsTable } from '../db';

export function useSupplements(user: 'diana' | 'estefania') {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [idByNotionId, setIdByNotionId] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getSupplements(user);

        // Sincroniza suplementos de Notion a SQLite (inserta los que faltan)
        let mapping: Record<string, number> = {};
        try {
          const notionIds = data.map((s) => s.notion_id);
          if (notionIds.length) {
            const existing = await db
              .select()
              .from(supplementsTable)
              .where(inArray(supplementsTable.notionId, notionIds));

            const existingNotionIds = new Set(existing.map((r) => r.notionId));
            const toInsert = data.filter((s) => !existingNotionIds.has(s.notion_id));

            if (toInsert.length) {
              const now = new Date().toISOString();
              await db.insert(supplementsTable).values(
                toInsert.map((s) => ({
                  name: s.name,
                  dose: s.dose,
                  unit: '',
                  phases: JSON.stringify(s.phase_specific === 'all' ? [] : [s.phase_specific]),
                  notionId: s.notion_id,
                  createdAt: now,
                  updatedAt: now,
                }))
              );
            }

            const allRows = await db
              .select()
              .from(supplementsTable)
              .where(inArray(supplementsTable.notionId, notionIds));
            mapping = Object.fromEntries(
              allRows
                .filter((r) => r.notionId)
                .map((r) => [r.notionId as string, r.id])
            );
          }
        } catch (err) {
          // Si falla el sync local, no bloquea la UI; solo deja el tracking desactivado.
          console.warn('Failed to sync Notion supplements to local DB', err);
        }

        if (!cancelled) {
          setSupplements(data);
          setIdByNotionId(mapping);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    supplements,
    loading,
    error,
    idByNotionId,
  };
}
