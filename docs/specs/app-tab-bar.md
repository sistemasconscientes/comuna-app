# Spec: Barra de pestañas principal

**Implementación:** [`App.tsx`](../../App.tsx)

---

## Alcance

Pestañas inferiores de la app (sin React Navigation): estado local `activeTab` y render condicional de pantallas.

---

## Pestañas en la barra inferior

| Pestaña | Pantalla | Rol |
|---------|----------|-----|
| Inicio | `Home` | Fase del ciclo, progreso del día, lista de suplementos para **hoy** (`useDailyLog(user, todayKey)` con `todayKey` de `useCalendarDayLocal`). Cabecera con ⚙️ abre **Perfil**. |
| Stock | `Stock` | Inventario / frascos. |
| Comidas | `MealPrep` | Plan de comidas. |
| Salud | `HealthKitData` | Lecturas de Apple Salud visibles (valor, sin datos, permiso o error); ver [`healthkit-data-screen.md`](./healthkit-data-screen.md). |

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
| TAB-1 | La barra inferior muestra exactamente cuatro pestañas: Inicio, Stock, Comidas, Salud. **No** incluye Perfil. |
| TAB-2 | No existe ruta ni pestaña «Checklist» accesible desde la UI. |
| TAB-3 | Inicio sigue permitiendo marcar/desmarcar suplementos para la fecha de hoy. |
| TAB-4 | Barra **flotante** tipo píldora: márgenes laterales (~16), elevación/sombra en iOS, fondo oscuro semitransparente; cada pestaña con **icono** (Ionicons) + etiqueta; activa en terracota (`#C97B6E`), inactiva en blanco atenuado. Coherente con [`home-screen-ui.md`](./home-screen-ui.md). |
| TAB-5 | Perfil se abre desde el botón ⚙️ del header de Inicio. Desde Perfil, la usuaria puede volver con la fila «‹ Inicio» en la parte superior **y** pulsando cualquier pestaña de la barra inferior (cambia `activeTab` y deja de mostrar `Profile`). |
| TAB-6 | **Safe area iOS:** `SafeAreaView` en `App.tsx` con `edges={['left','right']}`. La tab bar flotante usa `position: 'absolute'`, `bottom: insets.bottom + 10` y márgenes horizontales. Listas/scroll suman `insets.bottom + FLOATING_TAB_BAR_EXTRA` (`src/constants/floatingTabBar.ts`, ~78 pt de margen + píldora + aire) para que el último ítem no quede bajo la píldora. Gate: `paddingTop` / `paddingBottom` con insets. |
