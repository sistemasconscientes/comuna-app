# Pantalla Comidas (meal prep Notion)

## Alcance

- Pantalla [`src/screens/MealPrep.tsx`](../../src/screens/MealPrep.tsx): `getMealPrep()` (hijos directos de la página del plan, `listBlockChildrenAll` en `notion.ts`) → `expandMealPrepNotionBlocks(prep.blocks, fetchHijosTabla)` → `getTodayMeals(expanded, user)` (usuaria del contexto). El callback de expansión delega en `listNotionBlockChildrenPage` (`notion.ts`), que usa `notionFetch` y **rechaza respuestas HTTP no OK** (no se enmascaran 401/403 como lista vacía).
- Navegación: pestaña **Comidas** en la barra inferior de [`App.tsx`](../../App.tsx), mismo patrón que Inicio / Stock (Perfil fuera de la barra; ver [`app-tab-bar.md`](./app-tab-bar.md)).

## Parsing (`mealPrepParser.ts`)

| # | Comportamiento |
|---|----------------|
| 1 | Día actual: `new Date().getDay()` con nombres en español (0 = Domingo … 6 = Sábado). |
| 2 | Debe existir un `heading_1`, `heading_2` o `heading_3` cuyo texto normalizado **incluya** `plan semanal` (p. ej. "📅 Plan semanal"). Sin ese bloque, `getTodayMeals` devuelve `null`. Solo se consideran `heading_3` **posteriores** a la ancla para el día — se ignora Chef Prep u otras secciones anteriores (p. ej. "Prep del viernes pasado"). |
| 3 | Se toma el primer `heading_3` (tras la ancla) cuyo texto normalizado **contiene** el nombre del día (p. ej. "Lunes" en "Lunes 23 mar — Lútea 🦥"). |
| 4 | Tras ese heading, los bloques van hasta el siguiente `heading_3` o `heading_2` (exclusivo). |
| 5 | En ese tramo, la primera tabla (`type === "table"`): filas `table_row` consecutivas **tras** el bloque tabla en la lista ya expandida. |
| 6 | Primera fila se **omite solo si** la primera columna (texto normalizado) es **Comida** o **Tipo**. Plato: fila con **exactamente 2 celdas** → columna 1; **3 o más celdas** → columna 1 si `diana`, columna 2 si `estefanía`. |
| 7 | Segundo argumento `getTodayMeals(blocks, user?)` con `user` por defecto `diana`. Si no hay heading del día, tabla, o filas de datos, devuelve `null` → UI: "No hay plan para hoy". |

## Criterios de UI

| # | Criterio |
|---|----------|
| U1 | Muestra título de semana (`prep.title`) cuando existe plan. |
| U2 | Subtítulo = texto completo del `heading_3` del día. |
| U3 | Lista de `{ tipo, plato }` con estilo coherente con el resto de pantallas (fondo `#FAFAFA`, tarjetas blancas). |
| U4 | Estado de carga con `ActivityIndicator` y texto "Cargando plan…". |
| U5 | Errores de red/API en banner rojo (mismo espíritu que Home). |

## API Notion

- `getMealPrep` (en `notion.ts`) lista **toda** la página del plan con `listBlockChildrenAll`; las filas `table_row` **no** vienen en ese listado.
- La pantalla llama `expandMealPrepNotionBlocks`, que por cada bloque `table` pide `GET /v1/blocks/{id}/children?page_size=…` vía `listNotionBlockChildrenPage` (mismo cliente y manejo de errores que el resto de Notion).

---

## Cierre de feature (Comidas / meal prep)

### Qué incluye

| Pieza | Descripción |
|-------|-------------|
| Hub Notion | Página con `heading_2` **Comidas Activas** → primer `child_page` = plan semanal activo (`NOTION_MEAL_PREP_HUB_PAGE_ID`, opcional). |
| `getMealPrep()` | Resuelve hub + plan; devuelve `{ title, pageId, blocks }` o `null`. |
| Expansión de tablas | `expandMealPrepNotionBlocks` inserta tras cada `table` sus hijos `table_row` (un fetch por tabla en pantalla). |
| `getTodayMeals()` | Ancla obligatoria "Plan semanal" (`heading_1`/`2`/`3`), día en `heading_3` después; primera tabla; 2 vs 3+ columnas; cabecera si col0 es Comida/Tipo; `user` para plato si ≥3 columnas. |
| UI | Pestaña **Comidas** en `App.tsx`; estados carga / vacío / error. |

### Archivos tocados (referencia para commit)

- `src/api/notion.ts` — `getMealPrep`, `listNotionBlockChildrenPage`, env hub opcional.
- `src/screens/MealPrep.tsx` — fetcher: prep → expand → `getTodayMeals(expanded, user)`.
- `src/utils/mealPrepParser.ts` — `expandMealPrepNotionBlocks`, `getTodayMeals`, tipos `NotionBlock`.
- `src/utils/mealPrepParser.test.ts` — tests del parser.
- `App.tsx` — tab `comidas`.
- `src/types/env.d.ts` — `NOTION_MEAL_PREP_HUB_PAGE_ID`.
- `README.md` — variable opcional en ejemplo `.env`.
- Specs: `docs/specs/notion-meal-prep.md`, este archivo, `docs/specs/README.md`; reglas `notion-api.mdc`; `CLAUDE.md`.

### PostHog

- `meal_prep_loaded` — al terminar la carga de la pestaña (con o sin plan semanal).
- `notion_meal_prep_load_failed` — error en el flujo (fetch/expand/parse). Ver [`posthog-analytics.md`](./posthog-analytics.md).

### Checklist antes de merge

- [ ] `.env` con `NOTION_MEAL_PREP_HUB_PAGE_ID` si se usa Comidas (opcional).
- [ ] Estructura Notion: un heading (1/2/3) con **Plan semanal** antes de los días; bajo cada día, `heading_3` + tabla; sección **Comidas Activas** en el hub.
- [ ] Si este PR sube versión de app: bump `version` y `nativeBuild` en `package.json`, luego `npm run version:sync` → [`release-versioning.md`](./release-versioning.md).

### Mensaje de commit sugerido

```
feat(comidas): meal prep desde Notion (hub Comidas Activas + pestaña Comidas)

- getMealPrep: plan activo child_page + listBlockChildrenAll en la página
- MealPrep: expandMealPrepNotionBlocks con fetch por tabla (NOTION_API_KEY @env)
- getTodayMeals: ancla Plan semanal obligatoria, día ES tras ancla, tabla 2 vs 3+ cols, skip cabecera Comida/Tipo, `user` para plato
- Tab Comidas en App; NOTION_MEAL_PREP_HUB_PAGE_ID opcional
- Specs y tests en mealPrepParser
```
