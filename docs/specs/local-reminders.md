# Recordatorios locales (registro nocturno + stock bajo)

## Contexto

Notificaciones **locales** con `expo-notifications` — sin push remoto ni servidor, coherente con la promesa de privacidad (`docs/PRIVACY.md`). Dos casos: recordar el registro diario de suplementos si no se completó, y avisar cuando un suplemento baja de stock.

## Diseño

| Pieza       | Archivo                         | Responsabilidad                                                                                                                                                                                                   |
| ----------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agenda pura | `src/utils/reminderSchedule.ts` | Fechas del batch (7 días), ids `daily-log-YYYY-MM-DD`, parse/format de hora, umbrales de stock (aviso ≤5 días, rearme ≥8). Testeable sin expo.                                                                    |
| I/O         | `src/api/localNotifications.ts` | Permiso **en contexto**, settings (`reminder_settings_v1`, default 21:00 apagado), reprogramación del batch, flag `daily_log_complete::<día>`, aviso de stock con histéresis (`low_stock_notified::<notion_id>`). |
| Hook        | `src/hooks/useReminders.ts`     | Estado del toggle/hora en Perfil; pide permiso al activar; `permissionDenied` cuando iOS ya no deja preguntar.                                                                                                    |
| Inicio      | `src/screens/Home.tsx`          | Reporta progreso del día (`reportDailyLogProgress`): completo ⇒ reprograma saltando hoy; desmarcar lo rearma.                                                                                                     |
| Stock       | `src/screens/Stock.tsx`         | Tras cargar stock, `notifyLowStockOnce` con días restantes por ítem.                                                                                                                                              |
| App         | `App.tsx`                       | `configureNotificationHandler()` (banner en foreground, sin sonido).                                                                                                                                              |

## Reglas

- **Batch de 7 one-off** en vez de repetitiva: iOS no permite cancelar una sola ocurrencia de una repetitiva. Cobertura de una semana sin abrir la app; cada apertura/cambio reprograma.
- Hoy solo se incluye si la hora no pasó **y** el registro no está completo.
- Sin permiso ⇒ nunca se programa nada (el toggle lo pide en contexto; si está denegado se orienta a Ajustes).
- Stock bajo: un aviso por cruce de umbral por suplemento; se rearma al superar 8 días (histéresis anti-spam). Se evalúa al visitar Stock (limitación v1).

## QA manual

1. Activar recordatorio en Perfil → iOS pide permiso → elegir hora futura cercana → cerrar app → llega notificación.
2. Marcar todos los suplementos del día → la de hoy no llega (mañana sí).
3. Desmarcar uno → vuelve a programarse hoy (si la hora no pasó).
4. Bajar `totalPills` de un ítem para quedar <5 días → visitar Stock → llega un único aviso; repetir visita no duplica.
