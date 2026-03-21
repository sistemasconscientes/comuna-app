import { useCallback, useMemo, useState } from 'react';

/** Fecha local de hoy como YYYY-MM-DD (no UTC). */
export function localTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
