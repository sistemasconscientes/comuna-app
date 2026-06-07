import { useEffect, useState } from 'react';
import { inArray } from 'drizzle-orm';
import { getSharedStock, type SharedStock } from '../api/sharedStock';
import { getSupplements } from '../api/notion';
import type { Supplement } from '../types';
import { db, supplements as supplementsTable } from '../db';
import type { User } from '../context/UserContext';
import { reportErrorToSentry } from '../utils/observability';

export type UseSupplementsOptions = {
  /** Si es false, se traen todos los suplementos (p. ej. Stock); el filtro por temporada es en la UI. */
  applyTemporadaFilter?: boolean;
  /** Día civil local (YYYY-MM-DD): al cambiar, refetch Notion aunque la fase sea la misma. */
  calendarDayKey?: string;
};

export type SupplementsWithStockPayload = {
  supplements: Supplement[];
  idByNotionId: Record<string, number>;
  sharedByNotionId: Record<string, SharedStock | null>;
};

export type SyncResult = {
  supplements: Supplement[];
  idByNotionId: Record<string, number>;
  /** `null` si el sync local fue OK; el error si SQLite falló (los datos de Notion sí se devuelven). */
  syncError: Error | null;
};

/**
 * Notion + sync SQLite. No lanza si solo falla el sync local: devuelve los datos de
 * Notion con `syncError` poblado para que la UI sepa que el mapping local quedó incompleto.
 * Las escrituras van en una transacción (atómicas: o entran todas o ninguna).
 */
export async function syncSupplementsFromNotion(
  user: User,
  currentPhase: string,
  applyTemporadaFilter: boolean,
): Promise<SyncResult> {
  const data = await getSupplements(user, currentPhase, applyTemporadaFilter);

  const notionIds = data.map((s) => s.notion_id);
  if (!notionIds.length) return { supplements: data, idByNotionId: {}, syncError: null };

  try {
    const mapping = await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(supplementsTable)
        .where(inArray(supplementsTable.notionId, notionIds));

      const existingNotionIds = new Set(existing.map((r) => r.notionId));
      const toInsert = data.filter((s) => !existingNotionIds.has(s.notion_id));

      if (toInsert.length) {
        const now = new Date().toISOString();
        await tx.insert(supplementsTable).values(
          toInsert.map((s) => ({
            name: s.name,
            dose: s.dose,
            unit: '',
            phases: JSON.stringify(s.phase_specific === 'all' ? [] : [s.phase_specific]),
            notionId: s.notion_id,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }

      const allRows = await tx
        .select()
        .from(supplementsTable)
        .where(inArray(supplementsTable.notionId, notionIds));
      return Object.fromEntries(
        allRows.filter((r) => r.notionId).map((r) => [r.notionId as string, r.id]),
      ) as Record<string, number>;
    });
    return { supplements: data, idByNotionId: mapping, syncError: null };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    reportErrorToSentry(e, { domain: 'sqlite', message: e.message, user });
    return { supplements: data, idByNotionId: {}, syncError: e };
  }
}

/** Stock: suplementos + mapping local + stock compartido (Persona Ambas). */
export async function fetchSupplementsWithStock(
  user: User,
  currentPhase: string,
): Promise<SupplementsWithStockPayload> {
  try {
    // syncError no se propaga aquí: este payload pasa por useCache (AsyncStorage) y
    // un Error no serializa. El display de sync incompleto en Stock va con la UI de errores.
    const { supplements, idByNotionId } = await syncSupplementsFromNotion(
      user,
      currentPhase,
      false,
    );
    const ambasIds = supplements.filter((s) => s.persona === 'Ambas').map((s) => s.notion_id);
    const pairs = await Promise.all(
      ambasIds.map(async (id) => [id, await getSharedStock(id)] as const),
    );
    const sharedByNotionId = Object.fromEntries(pairs);
    return { supplements, idByNotionId, sharedByNotionId };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    reportErrorToSentry(err, {
      domain: 'notion',
      message: err.message,
      user,
    });
    throw err;
  }
}

export function useSupplements(user: User, currentPhase: string, options?: UseSupplementsOptions) {
  const applyTemporadaFilter = options?.applyTemporadaFilter !== false;
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  /** Notion respondió pero el sync local a SQLite falló (mapping incompleto). */
  const [syncError, setSyncError] = useState<Error | null>(null);
  const [idByNotionId, setIdByNotionId] = useState<Record<string, number>>({});

  const phaseDep = applyTemporadaFilter ? currentPhase : '';
  const calendarDayKey = options?.calendarDayKey ?? '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const {
          supplements: data,
          idByNotionId: mapping,
          syncError: localSyncError,
        } = await syncSupplementsFromNotion(user, currentPhase, applyTemporadaFilter);

        if (!cancelled) {
          setSupplements(data);
          setIdByNotionId(mapping);
          setSyncError(localSyncError);
        }
      } catch (e) {
        if (!cancelled) {
          const err = e instanceof Error ? e : new Error(String(e));
          setError(err);
          reportErrorToSentry(err, {
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
  }, [user, phaseDep, applyTemporadaFilter, calendarDayKey]);

  return {
    supplements,
    loading,
    error,
    syncError,
    idByNotionId,
  };
}
