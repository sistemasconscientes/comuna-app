import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { usePostHog } from 'posthog-react-native';
import { getLocalTodayISO } from '../utils/dateUtils';

/** Una sola emisión PostHog por día nuevo aunque varios componentes usen `useCalendarDayLocal`. */
let lastPostedCalendarDayTick: string | null = null;

/** Fecha local de hoy como YYYY-MM-DD (delega en `getLocalTodayISO`). */
export function localTodayISO(): string {
  return getLocalTodayISO();
}

/**
 * Día civil local actual; se recalcula al montar y cuando la app pasa a `active`.
 * Dispara `calendar_day_tick` en PostHog si el día cambió (best-effort).
 * @see docs/specs/daily-log-local-calendar.md
 */
export function useCalendarDayLocal(): string {
  const posthog = usePostHog();
  const [todayKey, setTodayKey] = useState(() => getLocalTodayISO());

  useEffect(() => {
    const sync = () => {
      const next = getLocalTodayISO();
      setTodayKey((prev) => {
        if (prev !== next && posthog && lastPostedCalendarDayTick !== next) {
          lastPostedCalendarDayTick = next;
          posthog.capture('calendar_day_tick', {
            previous_calendar_day: prev,
            calendar_day: next,
            reason: 'app_active',
          });
        }
        return next;
      });
    };

    sync();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') sync();
    });
    return () => sub.remove();
  }, [posthog]);

  return todayKey;
}

/** Suma días a una fecha ISO en calendario local. */
export function addDaysISO(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function compareISODates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Etiqueta legible en español (capitalización de weekday según locale). */
export function formatDateLabelES(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function useSelectableLogDate() {
  const [dateISO, setDateISO] = useState(localTodayISO);

  const goPrevDay = useCallback(() => {
    setDateISO((d) => addDaysISO(d, -1));
  }, []);

  const goNextDay = useCallback(() => {
    setDateISO((d) => {
      const cap = localTodayISO();
      const next = addDaysISO(d, 1);
      return compareISODates(next, cap) > 0 ? d : next;
    });
  }, []);

  const setToday = useCallback(() => {
    setDateISO(localTodayISO());
  }, []);

  const isAtToday = useMemo(
    () => compareISODates(dateISO, localTodayISO()) === 0,
    [dateISO],
  );

  const formattedLabel = useMemo(() => formatDateLabelES(dateISO), [dateISO]);

  return { dateISO, formattedLabel, goPrevDay, goNextDay, setToday, isAtToday };
}
