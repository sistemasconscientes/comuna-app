# Spec: Barra de pestañas principal

**Implementación:** [`App.tsx`](../../App.tsx)

---

## Alcance

Pestañas inferiores de la app (sin React Navigation): estado local `activeTab` y render condicional de pantallas.

---

## Pestañas en la barra inferior

| Pestaña | Pantalla | Rol |
|---------|----------|-----|
| Inicio | `Home` | Fase del ciclo, progreso del día, lista de suplementos para **hoy** (`useDailyLog(user)` con fecha por defecto). Cabecera con ⚙️ abre **Perfil**. |
| Stock | `Stock` | Inventario / frascos. |
| Comidas | `MealPrep` | Plan de comidas. |

## Perfil (fuera de la barra)

| Acceso | Pantalla | Rol |
|--------|----------|-----|
| ⚙️ en **Inicio** (y fila «‹ Inicio» / pestañas inferiores) | `Profile` | Usuario activo, fase, **Mis tomas por día** (`DailyLogByDate`), HealthKit QA, PostHog dev. |

---

## Checklist retirado (redundancia)

La pestaña **Checklist** se eliminó: duplicaba la lista de suplementos del día respecto a **Inicio**, con UI distinta (FlatList + checkbox explícito).

**Nota:** la edición por fecha distinta de «hoy» vive en Perfil → **Mis tomas por día** (ver [`daily-log-by-date.md`](./daily-log-by-date.md)).

---

## Criterios de aceptación

| ID | Criterio |
|----|----------|
| TAB-1 | La barra inferior muestra exactamente tres pestañas: Inicio, Stock, Comidas. **No** incluye Perfil. |
| TAB-2 | No existe ruta ni pestaña «Checklist» accesible desde la UI. |
| TAB-3 | Inicio sigue permitiendo marcar/desmarcar suplementos para la fecha de hoy. |
| TAB-4 | Estilo visual alineado con [`home-screen-ui.md`](./home-screen-ui.md): fondo crema en la zona de pestañas, pestaña activa con fondo terracota (`#C97B6E`) y texto claro. |
| TAB-5 | Perfil se abre desde el botón ⚙️ del header de Inicio. Desde Perfil, la usuaria puede volver con la fila «‹ Inicio» en la parte superior **y** pulsando cualquier pestaña de la barra inferior (cambia `activeTab` y deja de mostrar `Profile`). |
