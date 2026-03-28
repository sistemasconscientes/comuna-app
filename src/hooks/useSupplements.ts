import { useEffect, useState } from 'react';
import { usePostHog } from 'posthog-react-native';
import type { PostHog } from 'posthog-react-native';
import { inArray } from 'drizzle-orm';
import { getSharedStock, type SharedStock } from '../api/sharedStock';
import { getSupplements } from '../api/notion';
import type { Supplement } from '../types';
import { db, supplements as supplementsTable } from '../db';

export type UseSupplementsOptions = {
  /** Si es false, se traen todos los suplementos (p. ej. Stock); el filtro por temporada es en la UI. */
  applyTemporadaFilter?: boolean;
};

export type SupplementsWithStockPayload = {
  supplements: Supplement[];
  idByNotionId: Record<string, number>;
  sharedByNotionId: Record<string, SharedStock | null>;
};

/**
 * Notion + sync SQLite (misma lógica que `useSupplements`). No lanza si solo falla el sync local.
 */
export async function syncSupplementsFromNotion(
  user: 'diana' | 'estefania',
  currentPhase: string,
  applyTemporadaFilter: boolean,
  posthog: PostHog | null | undefined
): Promise<{ supplements: Supplement[]; idByNotionId: Record<string, number> }> {
  const data = await getSupplements(user, currentPhase, applyTemporadaFilter);

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
        allRows.filter((r) => r.notionId).map((r) => [r.notionId as string, r.id])
      );
    }
  } catch (err) {
    console.warn('Failed to sync Notion supplements to local DB', err);
    const msg = err instanceof Error ? err.message : String(err);
    posthog?.capture('notion_supplements_local_sync_failed', {
      domain: 'sqlite',
      message: msg,
      user,
    });
  }

  return { supplements: data, idByNotionId: mapping };
}

/** Stock: suplementos + mapping local + stock compartido (Persona Ambas). */
export async function fetchSupplementsWithStock(
  user: 'diana' | 'estefania',
  currentPhase: string,
  posthog: PostHog | null | undefined
): Promise<SupplementsWithStockPayload> {
  try {
    const { supplements, idByNotionId } = await syncSupplementsFromNotion(
      user,
      currentPhase,
      false,
      posthog
    );
    const ambasIds = supplements.filter((s) => s.persona === 'Ambas').map((s) => s.notion_id);
    const pairs = await Promise.all(ambasIds.map(async (id) => [id, await getSharedStock(id)] as const));
    const sharedByNotionId = Object.fromEntries(pairs);
    return { supplements, idByNotionId, sharedByNotionId };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    posthog?.capture('notion_supplements_sync_failed', {
      domain: 'notion',
      message: err.message,
      user,
    });
    throw err;
  }
}

export function useSupplements(
  user: 'diana' | 'estefania',
  currentPhase: string,
  options?: UseSupplementsOptions,
) {
  const posthog = usePostHog();
  const applyTemporadaFilter = options?.applyTemporadaFilter !== false;
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [idByNotionId, setIdByNotionId] = useState<Record<string, number>>({});

  const phaseDep = applyTemporadaFilter ? currentPhase : '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { supplements: data, idByNotionId: mapping } = await syncSupplementsFromNotion(
          user,
          currentPhase,
          applyTemporadaFilter,
          posthog
        );

        if (!cancelled) {
          setSupplements(data);
          setIdByNotionId(mapping);
        }
      } catch (e) {
        if (!cancelled) {
          const err = e instanceof Error ? e : new Error(String(e));
          setError(err);
          posthog?.capture('notion_supplements_sync_failed', {
            domain: 'notion',
            message: err.message,
            user,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, phaseDep, applyTemporadaFilter, posthog]);

  return {
    supplements,
    loading,
    error,
    idByNotionId,
  };
}
