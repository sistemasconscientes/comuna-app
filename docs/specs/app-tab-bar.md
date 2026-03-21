# Spec: Barra de pestañas principal

**Implementación:** [`App.tsx`](../../App.tsx)

---

## Alcance

Pestañas inferiores de la app (sin React Navigation): estado local `activeTab` y render condicional de pantallas.

---

## Pestañas actuales

| Pestaña | Pantalla | Rol |
|---------|----------|-----|
| Inicio | `Home` | Fase del ciclo, progreso del día, lista de suplementos para **hoy** (`useDailyLog()` con fecha por defecto). |
| Stock | `Stock` | Inventario / frascos. |
| Comidas | `MealPrep` | Plan de comidas. |
| Perfil | `Profile` | Usuario activo, fase, HealthKit QA, PostHog dev. |

---

## Checklist retirado (redundancia)

La pestaña **Checklist** se eliminó: duplicaba la lista de suplementos del día respecto a **Inicio**, con UI distinta (FlatList + checkbox explícito).

**Trade-off:** la antigua pantalla `Checklist` permitía elegir una fecha (`YYYY-MM-DD`) y marcar tomas para **días pasados**. Con solo Inicio, la UI queda acotada al **día actual**. Los datos en SQLite (`dailyLogs`) siguen siendo por fecha; solo falta interfaz para editar días históricos (se puede reintroducir más adelante en Inicio u otra pantalla).

---

## Criterios de aceptación

| ID | Criterio |
|----|----------|
| TAB-1 | La barra inferior muestra exactamente: Inicio, Stock, Comidas, Perfil. |
| TAB-2 | No existe ruta ni pestaña «Checklist» accesible desde la UI. |
| TAB-3 | Inicio sigue permitiendo marcar/desmarcar suplementos para la fecha de hoy. |
