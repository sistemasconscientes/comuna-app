# Spec: Registro de tomas por fecha (desde Perfil)

**Pantalla:** [`src/screens/DailyLogByDate.tsx`](../../src/screens/DailyLogByDate.tsx) · **Hook:** [`src/hooks/useSelectableLogDate.ts`](../../src/hooks/useSelectableLogDate.ts) (flechas día anterior/siguiente, tope “hoy” en local) · **Entrada:** [`src/screens/Profile.tsx`](../../src/screens/Profile.tsx)

---

## Alcance

- Desde **Perfil**, la usuaria abre una subpantalla a pantalla completa (mismo tab Perfil, sin nuevo router).
- Puede **ver y editar** qué suplementos marcó como tomados en una **fecha concreta** (`YYYY-MM-DD`).
- Los datos se leen/escriben en SQLite vía [`useDailyLog`](../../src/hooks/useDailyLog.ts) con **usuario activo** y esa fecha: cada fila en `daily_logs` pertenece a una usuaria (`diana` \| `estefania`); Inicio e historial no comparten tomas entre perfiles.

Fuera de alcance: reconstruir la fase del ciclo histórica por día; cálculo de qué suplementos correspondían en el pasado según Notion.

---

## Comportamiento

| Aspecto              | Regla                                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lista de suplementos | Misma fuente que Inicio: [`useSupplements`](../../src/hooks/useSupplements.ts) con usuario activo y **fase actual** (`useHealthData`). Es coherente con la pestaña Checklist retirada.                                                                                                                        |
| Fecha                | Se muestra etiqueta legible (español) + ISO; **‹ ›** cambian un día (no se puede ir más allá de hoy). **“Hoy”** y el tope derecho usan `getLocalTodayISO()` (calendario local del dispositivo; ver [daily-log-local-calendar.md](./daily-log-local-calendar.md)). **Ir a hoy** si la fecha elegida no es hoy. |
| Marcado              | Igual que Inicio: tap en fila alterna tomado/no tomado (`markTaken` en `dailyLogs` para usuario activo + fecha seleccionada).                                                                                                                                                                                 |
| Volver               | Control explícito que cierra la subpantalla y devuelve al contenido habitual de Perfil.                                                                                                                                                                                                                       |

---

## Criterios de aceptación

| ID   | Criterio                                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| DL-1 | En Perfil existe una acción clara para abrir «Mis tomas» / registro por fecha.                                               |
| DL-2 | La subpantalla muestra fecha con flechas día a día, contador tomados/total y lista alineada a suplementos de la fase actual. |
| DL-3 | Cambiar la fecha y marcar filas persiste en SQLite para esa fecha y el **usuario activo** (no se mezclan Diana/Estefanía).   |
| DL-4 | «Ir a hoy» / estado inicial llevan a la fecha local actual; la flecha derecha queda deshabilitada en ese día.                |
| DL-5 | «Volver» cierra la subpantalla sin cambiar de pestaña.                                                                       |

---

## Analítica

Ver fila `daily_log_history_opened` en [`posthog-analytics.md`](posthog-analytics.md).
