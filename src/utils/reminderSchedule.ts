/**
 * Lógica pura de los recordatorios locales (sin expo-notifications):
 * fechas del batch diario, identificadores y parsing de hora.
 */

/** Días futuros cubiertos por el batch (cobertura sin abrir la app). */
export const DAILY_REMINDER_BATCH_DAYS = 7;

/** Umbral de aviso de stock bajo (días restantes). */
export const LOW_STOCK_THRESHOLD_DAYS = 5;

/** Al superar este nivel se rearma el aviso (histéresis anti-spam). */
export const LOW_STOCK_RESET_DAYS = 8;

export interface DailyReminderPlanInput {
  now: Date;
  hour: number;
  minute: number;
  /** Hoy ya quedó registrado: la primera notificación va mañana. */
  skipToday: boolean;
  days?: number;
}

/**
 * Fechas exactas del batch de recordatorios. Hoy se incluye solo si la hora
 * aún no pasa y el registro no está completo.
 */
export function buildDailyReminderDates({
  now,
  hour,
  minute,
  skipToday,
  days = DAILY_REMINDER_BATCH_DAYS,
}: DailyReminderPlanInput): Date[] {
  const todayAtTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
  const startOffset = skipToday || todayAtTime.getTime() <= now.getTime() ? 1 : 0;
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = startOffset + i;
    out.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, hour, minute, 0));
  }
  return out;
}

const DAILY_REMINDER_ID_PREFIX = 'daily-log-';

export function isDailyReminderId(id: string): boolean {
  return id.startsWith(DAILY_REMINDER_ID_PREFIX);
}

/** `daily-log-YYYY-MM-DD` en calendario local (estable ante reprogramación). */
export function reminderIdForDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${DAILY_REMINDER_ID_PREFIX}${y}-${m}-${day}`;
}

/** "HH:MM" → {hour, minute}; null si no es una hora válida. */
export function parseReminderTime(text: string): { hour: number; minute: number } | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(text);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
