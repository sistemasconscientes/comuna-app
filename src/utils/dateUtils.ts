/**
 * Día civil en el calendario local del dispositivo (no UTC).
 * @see docs/specs/daily-log-local-calendar.md — no usar toISOString().split('T')[0] para daily_logs ni "hoy".
 */
export function getLocalTodayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
