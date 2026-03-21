# Pantalla Comidas (meal prep Notion)

## Alcance

- Pantalla [`src/screens/MealPrep.tsx`](../../src/screens/MealPrep.tsx): `getMealPrep()` (hijos directos de la página del plan, `listBlockChildrenAll` en `notion.ts`) → `expandMealPrepNotionBlocks(prep.blocks, fetchHijosTabla)` → `getTodayMeals(expanded)`. El callback de expansión usa `fetch` a la API de Notion con `NOTION_API_KEY` desde `@env` (mismo criterio que `notion.ts`).
- Navegación: pestaña **Comidas** en la barra inferior de [`App.tsx`](../../App.tsx), mismo patrón que Inicio / Stock / Perfil (ver [`app-tab-bar.md`](./app-tab-bar.md)).

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

- `getMealPrep` (en `notion.ts`) lista **toda** la página del plan con `listBlockChildrenAll`; las filas `table_row` **no** vienen en ese listado.
- La pantalla llama `expandMealPrepNotionBlocks`, que por cada bloque `table` pide `GET /v1/blocks/{id}/children?page_size=…` (vía callback `fetch` + `NOTION_API_KEY`).
- Sigue existiendo `listNotionBlockChildrenPage` en `notion.ts` para otros usos; la pestaña Comidas no depende de ella.

---

## Cierre de feature (Comidas / meal prep)

### Qué incluye

| Pieza | Descripción |
|-------|-------------|
| Hub Notion | Página con `heading_2` **Comidas Activas** → primer `child_page` = plan semanal activo (`NOTION_MEAL_PREP_HUB_PAGE_ID`, opcional). |
| `getMealPrep()` | Resuelve hub + plan; devuelve `{ title, pageId, blocks }` o `null`. |
| Expansión de tablas | `expandMealPrepNotionBlocks` inserta tras cada `table` sus hijos `table_row` (un fetch por tabla en pantalla). |
| `getTodayMeals()` | Día local en español, sección bajo `heading_3`, primera tabla, filas tipo/plato; cabecera si col0 es Comida/Tipo. |
| UI | Pestaña **Comidas** en `App.tsx`; estados carga / vacío / error. |

### Archivos tocados (referencia para commit)

- `src/api/notion.ts` — `getMealPrep`, `listNotionBlockChildrenPage`, env hub opcional.
- `src/screens/MealPrep.tsx` — efecto: prep → expand → `getTodayMeals`.
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
- [ ] Estructura Notion: bajo cada día, `heading_3` + tabla columnas tipo/plato; sección **Comidas Activas** en el hub.
- [ ] Si este PR sube versión de app: bump semver en `package.json` y `npm run version:sync` → [`release-versioning.md`](./release-versioning.md).

### Mensaje de commit sugerido

```
feat(comidas): meal prep desde Notion (hub Comidas Activas + pestaña Comidas)

- getMealPrep: plan activo child_page + listBlockChildrenAll en la página
- MealPrep: expandMealPrepNotionBlocks con fetch por tabla (NOTION_API_KEY @env)
- getTodayMeals: día ES, tabla del tramo, skip cabecera Comida/Tipo
- Tab Comidas en App; NOTION_MEAL_PREP_HUB_PAGE_ID opcional
- Specs y tests en mealPrepParser
```
