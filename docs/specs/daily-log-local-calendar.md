# Spec: Día civil local, refetch Notion y safe area (Inicio / daily_logs)

**Relacionado:** [`useDailyLog`](../../src/hooks/useDailyLog.ts) · [`useCalendarDayLocal`](../../src/hooks/useSelectableLogDate.ts) · [`getLocalTodayISO`](../../src/utils/dateUtils.ts) · [`useSupplements`](../../src/hooks/useSupplements.ts) · [`useHealthData`](../../src/hooks/useHealthData.ts) · Inicio [`Home.tsx`](../../src/screens/Home.tsx) · [`DailyLogByDate.tsx`](../../src/screens/DailyLogByDate.tsx)

---

## Alcance

1. **Fecha “hoy” y `daily_logs.date`:** usar el **calendario local del dispositivo** (`YYYY-MM-DD`), no UTC (`toISOString().split('T')[0]` ni equivalentes).
2. **Cambio de día:** al detectar un nuevo día civil local (incl. app vuelve a primer plano con fecha distinta), **refetch** de suplementos Notion y de datos de fase/salud que dependan de Notion.
3. **UI:** estados de **carga** y **error** visibles en Inicio e historial de tomas; scroll/listas respetan **safe area** (Dynamic Island, home indicator).
4. **Regresión:** no reintroducir UTC para claves de `daily_logs` ni para “hoy” de producto.

---

## Regla anti-regresión (fechas)

| Prohibido para `daily_logs.date` y “hoy” de producto | Usar en su lugar |
|------------------------------------------------------|------------------|
| `new Date().toISOString().split('T')[0]` o slice equivalente | `getLocalTodayISO()` desde [`dateUtils.ts`](../../src/utils/dateUtils.ts) |
| Cualquier derivación UTC del “día” | Calendario local del teléfono (misma semántica que `Date#getFullYear` / `getMonth` / `getDate`) |

Los timestamps de instante (`createdAt`, `updatedAt` en SQLite) pueden seguir en ISO UTC.

---

## Comportamiento

| Aspecto | Regla |
|---------|--------|
| Clave de día | `useCalendarDayLocal()` mantiene `todayKey`; se recalcula al montar y en `AppState` → `active` con `getLocalTodayISO()`. |
| Inicio | `useDailyLog(user, todayKey)`; `useSupplements` y `useHealthData` reciben `calendarDayKey: todayKey` para invalidar fetch al cambiar día. |
| Tras lectura SQLite | Si alguna fila devuelta tuviera `date !== logDate` esperado, no usar filas inconsistentes (defensa) y reportar a Sentry. |
| Notion | Sin caché persistente nueva; basta dependencia de `calendarDayKey` en los efectos de fetch. |
| Errores | Si falla Notion (o carga inicial), banner o mensaje explícito; no confundir con “0 suplementos” en silencio. |
| Safe area | `App.tsx`: `SafeAreaView` solo laterales; pestañas aplican `insets.top`; scroll con `insets.bottom + FLOATING_TAB_BAR_EXTRA` por tab bar flotante (ver [`app-tab-bar.md`](./app-tab-bar.md) TAB-6). |

---

## Criterios de aceptación

| ID | Criterio |
|----|----------|
| LC-1 | `daily_logs` para “hoy” en Inicio usa la misma fecha civil que el reloj local del dispositivo (no adelanta el día por UTC por la tarde en zonas detrás de UTC). |
| LC-2 | Al pasar de día (o reabrir la app ya en día nuevo), la lista de suplementos y la fase se vuelven a pedir a Notion / flujo actual. |
| LC-3 | Con red fallida o error de API, la usuaria ve error visible en Inicio e historial de tomas, no solo lista vacía. |
| LC-4 | Cabecera de Inicio y últimos ítems de listas no quedan tapados por Dynamic Island / home indicator en dispositivos con notch o isla (p. ej. iPhone 16 Pro). |
| LC-5 | Diana y Estefanía tienen logs independientes; cambiar perfil no mezcla tomas. |

---

## Checklist manual pre-release (5–10 min)

- [ ] Inicio carga suplementos y fase con usuario de prueba.
- [ ] Forzar error de red (avión / host bloqueado): aparece mensaje de error, no UI “vacía” confusa.
- [ ] Cambiar de día o reabrir tras medianoche local: checklist nuevo y datos de Notion refrescados.
- [ ] Scroll hasta el final en Inicio y Stock: último contenido legible sobre tab bar / home indicator.
- [ ] Cabecera Inicio (nombre, fase) visible bajo Dynamic Island o notch en simulador/dispositivo reciente.

---

## Analítica

Evento opcional `calendar_day_tick` al cambiar `todayKey` (p. ej. al volver a `active`): ver [`posthog-analytics.md`](./posthog-analytics.md).
