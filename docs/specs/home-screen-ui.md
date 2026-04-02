# Spec: UI pantalla Inicio (referencia visual)

**Implementación:** [`src/screens/Home.tsx`](../../src/screens/Home.tsx), [`App.tsx`](../../App.tsx) (fondo / barra de pestañas); tarjeta de fase del ciclo (barra + mensaje) en `Home.tsx` — ver [`home-energy-chart.md`](./home-energy-chart.md).

---

## Alcance

**Tema oscuro por defecto:** paleta en `src/theme/colors.ts` (fondo `#141210`, tarjetas elevadas, texto claro), acento terracota (`#C97B6E`) en activos y progreso. Cabecera con emoji + nombre, fecha, pastilla de fase, ⚙️ → Perfil, lista del día en tarjeta con separadores y checkboxes. `app.json`: `userInterfaceStyle: dark`, splash alineado al fondo.

---

## Criterios de aceptación

| ID | Criterio |
|----|----------|
| UI-1 | Fondo de pantalla Inicio y `App`: tono oscuro cálido (`theme.bg`), coherente con tab bar flotante. |
| UI-2 | Cabecera superior: fila con bloque izquierdo (emoji + nombre en línea, fecha debajo en gris) y botón circular/outline de ajustes a la derecha que navega a Perfil (`onOpenSettings`). |
| UI-3 | Debajo de la fecha: pastilla de fase con fondo rosado muy suave, punto terracota y texto de fase legible (sin tarjeta grande centrada duplicada si la info ya está en la pastilla). |
| UI-4 | Lista del día: tarjeta `theme.card`, esquinas redondeadas, filas separadas por línea sutil; checkbox circular; al marcar: relleno terracota y marca ✓ blanca. |
| UI-5 | Barra de pestañas: **flotante** (píldora oscura con sombra), icono + texto por pestaña; activa terracota, inactivas atenuadas; ver [`app-tab-bar.md`](./app-tab-bar.md) TAB-4. |
| UI-6 | Entre la cabecera y «Para hoy»: tarjeta de **barra de fase** prioritaria (tipografía y pista legibles; ver [`home-energy-chart.md`](./home-energy-chart.md)). El avance de suplementos es secundario: una línea con contador `n/m` y barra fina, sin tarjeta grande duplicada. |
| UI-7 | Contenido scrollable con `padding` que tenga en cuenta **safe area** (cabecera bajo Dynamic Island / notch, final de lista sobre home indicator); estados de **carga** y **error** visibles (ver [`daily-log-local-calendar.md`](./daily-log-local-calendar.md)). |

---

## Fuera de alcance

- Rediseños mayores fuera de paleta y jerarquía descrita. Fecha del día, refetch Notion y detalle de safe area: [`daily-log-local-calendar.md`](./daily-log-local-calendar.md).
- La **tab bar** usa `@expo/vector-icons` (Ionicons). El botón ⚙️ de Inicio puede seguir en Unicode.
