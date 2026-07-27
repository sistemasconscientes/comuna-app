import React from 'react';
import { usePostHog } from 'posthog-react-native';
import {
  DEFAULT_REMINDER_SETTINGS,
  ensureNotificationPermission,
  isDailyLogComplete,
  loadReminderSettings,
  rescheduleDailyLogReminders,
  saveReminderSettings,
  type ReminderSettings,
} from '../api/localNotifications';
import { useCalendarDayLocal } from './useSelectableLogDate';

/**
 * Recordatorio nocturno de registro (Perfil): settings + permiso en contexto.
 * La reprogramación diaria vive en `reportDailyLogProgress` (Inicio).
 */
export function useReminders() {
  const posthog = usePostHog();
  const todayKey = useCalendarDayLocal();
  const [settings, setSettings] = React.useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [hydrated, setHydrated] = React.useState(false);
  const [permissionDenied, setPermissionDenied] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void loadReminderSettings().then((s) => {
      if (!cancelled) {
        setSettings(s);
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistAndReschedule = React.useCallback(
    async (next: ReminderSettings) => {
      setSettings(next);
      await saveReminderSettings(next);
      await rescheduleDailyLogReminders(await isDailyLogComplete(todayKey));
    },
    [todayKey],
  );

  const setEnabled = React.useCallback(
    (enabled: boolean) => {
      void (async () => {
        if (enabled) {
          const granted = await ensureNotificationPermission();
          if (!granted) {
            setPermissionDenied(true);
            posthog?.capture('reminder_permission_denied');
            return;
          }
        }
        setPermissionDenied(false);
        await persistAndReschedule({ ...settings, enabled });
        posthog?.capture(enabled ? 'reminder_enabled' : 'reminder_disabled');
      })();
    },
    [persistAndReschedule, posthog, settings],
  );

  const setTime = React.useCallback(
    (hour: number, minute: number) => {
      void (async () => {
        await persistAndReschedule({ ...settings, hour, minute });
        posthog?.capture('reminder_time_changed', { hour, minute });
      })();
    },
    [persistAndReschedule, posthog, settings],
  );

  return { settings, hydrated, permissionDenied, setEnabled, setTime };
}
