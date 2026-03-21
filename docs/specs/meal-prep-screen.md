# Pantalla Comidas (meal prep Notion)

## Alcance

- Pantalla [`src/screens/MealPrep.tsx`](../../src/screens/MealPrep.tsx): `getMealPrep()` (página completa, un nivel) → `expandMealPrepNotionBlocks(prep.blocks, listNotionBlockChildrenPage)` → `getTodayMeals(expanded)`.
- Navegación: pestaña **Comidas** en la barra inferior de [`App.tsx`](../../App.tsx), mismo patrón que Inicio / Checklist / Stock / Perfil.

## Parsing (`mealPrepParser.ts`)

| # | Comportamiento |
|---|----------------|
| 1 | Día actual: `new Date().getDay()` con nombres en español (0 = Domingo … 6 = Sábado). |
| 2 | Se busca el primer `heading_3` cuyo texto normalizado (minúsculas, sin tildes) **contiene** el nombre del día (p. ej. "Lunes" en "Lunes 23 mar — Lútea 🦥"). |
| 3 | Tras ese heading, los bloques van hasta el siguiente `heading_3` o `heading_2` (exclusivo). |
| 4 | En ese tramo, la primera tabla (`type === "table"`): las filas son bloques `table_row` consecutivos **tras** el bloque tabla en la lista ya expandida. |
| 5 | Primera fila se **omite solo si** la primera columna (texto normalizado) es **Comida** o **Tipo**; columnas: tipo (p. ej. `cells[0][0].plain_text` o texto unido de la celda), plato igual en columna 1. |
| 6 | Si no hay heading del día, tabla, o filas de datos, `getTodayMeals` devuelve `null` → UI: "No hay plan para hoy". |

## Criterios de UI

| # | Criterio |
|---|----------|
| U1 | Muestra título de semana (`prep.title`) cuando existe plan. |
| U2 | Subtítulo = texto completo del `heading_3` del día. |
| U3 | Lista de `{ tipo, plato }` con estilo coherente con el resto de pantallas (fondo `#FAFAFA`, tarjetas blancas). |
| U4 | Estado de carga con `ActivityIndicator` y texto "Cargando plan…". |
| U5 | Errores de red/API en banner rojo (mismo espíritu que Home). |

## API Notion

- `getMealPrep` usa solo `listBlockChildrenAll` en la página del plan. `listNotionBlockChildrenPage` (mismo `notionFetch` / headers que el cliente) se pasa a `expandMealPrepNotionBlocks` para traer hijos de cada `table` (`page_size` acotado, p. ej. 100).
