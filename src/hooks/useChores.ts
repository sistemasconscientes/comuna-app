import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePostHog } from 'posthog-react-native';
import { discoverChoresDbId, getChores, setChoreLastDone } from '../api/notion';
import {
  getNotionSettings,
  getNotionSettingsSource,
  updateStoredNotionIds,
} from '../config/notionSettings';
import { getNotionSupplementPersona, getProfileLabel, isSharedPersona } from '../config/profiles';
import type { User } from '../context/UserContext';
import type { Chore } from '../types';
import { choreStatusForDay, type ChoreDayStatus } from '../utils/choreSchedule';
import { reportErrorToSentry } from '../utils/observability';

/** Respaldo local de «hecha» cuando la DB no tiene `Última vez` (o en demo). */
const LOCAL_DONE_KEY = 'chores_local_done_v1';
/** Valor anterior a marcar hoy, para poder desmarcar sin perder la fecha previa. */
const UNDO_KEY = 'chores_undo_v1';

type DoneRecord = { lastDone: string | null; doneBy: string };

async function readMap(key: string): Promise<Record<string, DoneRecord>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, DoneRecord>) : {};
  } catch {
    return {};
  }
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export type ChoreItem = Chore & { status: ChoreDayStatus };

export interface ChoreGroups {
  mine: ChoreItem[];
  shared: ChoreItem[];
  others: ChoreItem[];
}

/** Atrasadas primero, luego por nombre; las hechas al final de su grupo. */
function sortItems(items: ChoreItem[]): ChoreItem[] {
  return [...items].sort((a, b) => {
    if (a.status.doneToday !== b.status.doneToday) return a.status.doneToday ? 1 : -1;
    if (a.status.overdueDays !== b.status.overdueDays) {
      return b.status.overdueDays - a.status.overdueDays;
    }
    return a.name.localeCompare(b.name, 'es');
  });
}

/**
 * Tareas del hogar del día (DB «Tareas del hogar» en Notion). Al marcar se
 * escribe `Última vez` / `Hecha por` en Notion, así queda hecha para todo el
 * hogar; sin esas propiedades, se guarda en este teléfono.
 */
export function useChores(user: User, todayISO: string) {
  const posthog = usePostHog();
  const [chores, setChores] = useState<Chore[]>([]);
  const [syncsLastDone, setSyncsLastDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasDb, setHasDb] = useState(() => Boolean(getNotionSettings().choresDbId));
  const [discovering, setDiscovering] = useState(false);
  const inFlight = useRef(new Set<string>());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getChores();
      const local = res.syncsLastDone ? {} : await readMap(LOCAL_DONE_KEY);
      setChores(res.chores.map((c) => (local[c.notion_id] ? { ...c, ...local[c.notion_id] } : c)));
      setSyncsLastDone(res.syncsLastDone);
      setHasDb(Boolean(getNotionSettings().choresDbId) || getNotionSettingsSource() === 'demo');
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      reportErrorToSentry(err, { domain: 'chores', message: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, todayISO]);

  /** Cuentas conectadas antes de esta función: busca la DB sin pedir el token. */
  const discover = useCallback(async (): Promise<boolean> => {
    setDiscovering(true);
    try {
      const id = await discoverChoresDbId();
      if (!id) return false;
      await updateStoredNotionIds({ choresDbId: id });
      await load();
      return true;
    } catch (e) {
      reportErrorToSentry(e, { domain: 'chores', operation: 'discover' });
      return false;
    } finally {
      setDiscovering(false);
    }
  }, [load]);

  const toggle = useCallback(
    async (chore: Chore) => {
      if (inFlight.current.has(chore.notion_id)) return;
      inFlight.current.add(chore.notion_id);
      const undo = await readMap(UNDO_KEY);
      const doneToday = chore.lastDone === todayISO;
      const next: DoneRecord = doneToday
        ? (undo[chore.notion_id] ?? { lastDone: null, doneBy: '' })
        : { lastDone: todayISO, doneBy: getProfileLabel(user) };

      // Optimista: la fila cambia al instante.
      setChores((prev) =>
        prev.map((c) => (c.notion_id === chore.notion_id ? { ...c, ...next } : c)),
      );
      try {
        if (!doneToday) {
          undo[chore.notion_id] = { lastDone: chore.lastDone, doneBy: chore.doneBy };
        } else {
          delete undo[chore.notion_id];
        }
        await AsyncStorage.setItem(UNDO_KEY, JSON.stringify(undo));
        if (syncsLastDone) {
          await setChoreLastDone(chore.notion_id, next.lastDone, next.doneBy);
        } else {
          const local = await readMap(LOCAL_DONE_KEY);
          local[chore.notion_id] = next;
          await AsyncStorage.setItem(LOCAL_DONE_KEY, JSON.stringify(local));
        }
        posthog?.capture(doneToday ? 'chore_unchecked' : 'chore_checked', {
          frequency: chore.frequency,
        });
      } catch (e) {
        // Revertir si Notion no aceptó el cambio.
        setChores((prev) => prev.map((c) => (c.notion_id === chore.notion_id ? chore : c)));
        reportErrorToSentry(e, { domain: 'chores', operation: 'toggle' });
        throw e;
      } finally {
        inFlight.current.delete(chore.notion_id);
      }
    },
    [posthog, syncsLastDone, todayISO, user],
  );

  const groups: ChoreGroups = useMemo(() => {
    const mePersona = normalizeName(getNotionSupplementPersona(user));
    const out: ChoreGroups = { mine: [], shared: [], others: [] };
    for (const c of chores) {
      const status = choreStatusForDay(c, todayISO);
      if (!status.visible) continue;
      const item = { ...c, status };
      if (!c.persona || isSharedPersona(c.persona)) out.shared.push(item);
      else if (normalizeName(c.persona) === mePersona) out.mine.push(item);
      else out.others.push(item);
    }
    return {
      mine: sortItems(out.mine),
      shared: sortItems(out.shared),
      others: sortItems(out.others),
    };
  }, [chores, todayISO, user]);

  const pendingForMe = [...groups.mine, ...groups.shared].filter((c) => !c.status.doneToday).length;

  return {
    groups,
    pendingForMe,
    loading,
    error,
    hasDb,
    syncsLastDone,
    discovering,
    discover,
    toggle,
    refetch: load,
  };
}
