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

        // Intenta mapear cada suplemento de Notion a su fila local en SQLite
        let mapping: Record<string, number> = {};
        try {
          const notionIds = data.map((s) => s.notion_id);
          if (notionIds.length) {
            const rows = await db
              .select()
              .from(supplementsTable)
              .where(inArray(supplementsTable.notionId, notionIds));
            mapping = Object.fromEntries(
              rows
                .filter((r) => r.notionId)
                .map((r) => [r.notionId as string, r.id])
            );
          }
        } catch (err) {
          // Si falla el mapeo local, no bloquea la UI; solo deja el tracking desactivado.
          console.warn('Failed to map Notion supplements to local IDs', err);
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
