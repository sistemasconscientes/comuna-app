import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LOW_STOCK_RESET_DAYS,
  LOW_STOCK_THRESHOLD_DAYS,
  buildDailyReminderDates,
  isDailyReminderId,
  reminderIdForDate,
} from '../utils/reminderSchedule';
import { reportErrorToSentry } from '../utils/observability';

/**
 * Notificaciones locales (sin push remoto ni servidor): recordatorio nocturno
 * de registro y aviso de stock bajo. Ver `docs/specs/local-reminders.md`.
 */

/** Presentación en foreground (banner discreto, sin sonido). Llamar una vez en App. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Pide permiso solo en contexto (al activar recordatorios). */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain === false) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch (e) {
    reportErrorToSentry(e, { domain: 'local_notifications', operation: 'permission' });
    return false;
  }
}

async function hasNotificationPermission(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// ─── Settings del recordatorio diario ────────────────────────────────────────

const REMINDER_SETTINGS_KEY = 'reminder_settings_v1';

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { enabled: false, hour: 21, minute: 0 };

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_SETTINGS_KEY);
    if (!raw) return DEFAULT_REMINDER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      enabled: parsed.enabled === true,
      hour: typeof parsed.hour === 'number' ? parsed.hour : DEFAULT_REMINDER_SETTINGS.hour,
      minute: typeof parsed.minute === 'number' ? parsed.minute : DEFAULT_REMINDER_SETTINGS.minute,
    };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Recordatorio diario de registro ─────────────────────────────────────────

const DAY_COMPLETE_PREFIX = 'daily_log_complete::';

export async function isDailyLogComplete(dateKey: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DAY_COMPLETE_PREFIX + dateKey)) === '1';
  } catch {
    return false;
  }
}

/**
 * Reprograma el batch de recordatorios (7 días) según settings; `skipToday`
 * cuando el registro de hoy ya está completo. Cancela siempre los previos.
 */
export async function rescheduleDailyLogReminders(skipToday: boolean): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => isDailyReminderId(n.identifier))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    const settings = await loadReminderSettings();
    if (!settings.enabled || !(await hasNotificationPermission())) return;

    const dates = buildDailyReminderDates({
      now: new Date(),
      hour: settings.hour,
      minute: settings.minute,
      skipToday,
    });
    for (const date of dates) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminderIdForDate(date),
        content: {
          title: 'La Comuna',
          body: '¿Ya registraste tus suplementos de hoy? 🌿',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    }
  } catch (e) {
    reportErrorToSentry(e, { domain: 'local_notifications', operation: 'reschedule_daily' });
  }
}

/**
 * Progreso del registro del día (desde Inicio): persiste si quedó completo y
 * reprograma para que hoy no suene si ya terminó (y vuelva a sonar si desmarca).
 */
export async function reportDailyLogProgress(
  dateKey: string,
  takenCount: number,
  totalCount: number,
): Promise<void> {
  const complete = totalCount > 0 && takenCount >= totalCount;
  try {
    if (complete) await AsyncStorage.setItem(DAY_COMPLETE_PREFIX + dateKey, '1');
    else await AsyncStorage.removeItem(DAY_COMPLETE_PREFIX + dateKey);
  } catch {
    // Sin persistencia igual reprogramamos con el estado en mano.
  }
  await rescheduleDailyLogReminders(complete);
}

// ─── Aviso de stock bajo ─────────────────────────────────────────────────────

const LOW_STOCK_FLAG_PREFIX = 'low_stock_notified::';

export interface LowStockItem {
  notionId: string;
  name: string;
  daysRemaining: number | null;
}

/**
 * Notifica una sola vez por suplemento al cruzar el umbral; el aviso se rearma
 * cuando el stock vuelve a superar `LOW_STOCK_RESET_DAYS` (histéresis).
 */
export async function notifyLowStockOnce(items: LowStockItem[]): Promise<void> {
  if (!(await hasNotificationPermission())) return;
  for (const item of items) {
    if (item.daysRemaining == null || !item.notionId) continue;
    const flagKey = LOW_STOCK_FLAG_PREFIX + item.notionId;
    try {
      if (item.daysRemaining <= LOW_STOCK_THRESHOLD_DAYS) {
        const already = await AsyncStorage.getItem(flagKey);
        if (already) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Stock bajo',
            body: `A ${item.name} le quedan ~${Math.max(0, Math.round(item.daysRemaining))} días. ¿Recompra?`,
          },
          trigger: null,
        });
        await AsyncStorage.setItem(flagKey, '1');
      } else if (item.daysRemaining >= LOW_STOCK_RESET_DAYS) {
        await AsyncStorage.removeItem(flagKey);
      }
    } catch (e) {
      reportErrorToSentry(e, { domain: 'local_notifications', operation: 'low_stock' });
    }
  }
}
