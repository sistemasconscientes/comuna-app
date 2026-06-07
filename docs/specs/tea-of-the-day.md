# Té del día

## Alcance

Mostrar en Inicio un "Té del día" recomendado según la fase del ciclo del usuario seleccionado. Los datos vienen **directo de Notion** (BD de Tés), sin caché en SQLite ni estado global. El usuario puede rotar entre los tés disponibles ("quiero otro").

- API: `getTeasForPhase(phase: Phase)` en [`src/api/notion.ts`](../../src/api/notion.ts).
- Hook: `useTeas(phase)` en [`src/hooks/useTeas.ts`](../../src/hooks/useTeas.ts).
- UI: `TeaCard` en [`src/components/TeaCard.tsx`](../../src/components/TeaCard.tsx), renderizado en [`src/screens/Home.tsx`](../../src/screens/Home.tsx) tras el indicador de fase.

No toca la lógica de suplementos ni `daily_logs`, y no agrega tablas a SQLite.

## BD de Notion

- ID de la base de Tés: `235d8880-2045-81af-93a9-c0b96040f14d` (accesible vía la integración con `NOTION_API_KEY`; no requiere variable de entorno propia).
- Propiedades leídas (matching de nombres **resiliente**, varios candidatos, igual que `getSupplements`):
  - "¿Tengo en casa?" (checkbox) — candidatos `['¿Tengo en casa?', 'Tengo en casa?', 'Tengo en casa', '¿Tengo en casa']`.
  - "Fase del ciclo recomendada" (multi-select) — candidatos `['Fase del ciclo recomendada', 'Fase del ciclo', 'Fase recomendada', 'Fase']`.
  - Nombre (title) — `['Name', 'Nombre']`.
  - "Beneficios comprobables" (multi-select → `comprovable_benefits`).
  - "Beneficios holísticos" (multi-select → `holistic_benefits`).

## Mapeo de fase → etiquetas Notion

| `Phase`      | Etiquetas en "Fase del ciclo recomendada" |
| ------------ | ----------------------------------------- |
| `menstrual`  | `Menstruación 🩸`                         |
| `folicular`  | `Folicular 🏃🏻‍♀️`                            |
| `ovulatoria` | `Ovulación 🍑`                            |
| `lutea`      | `Lútea 🧘🏻‍♀️`, `Premenstrual 😾`             |

Nota: estos emojis son los de la BD de Tés y difieren de `PHASE_TO_LABEL` (tabla de fases por usuario).

## Criterios de aceptación

| #   | Criterio                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `getTeasForPhase` consulta toda la BD de Tés (paginado `queryDatabaseAll`) y **filtra en cliente**: no se envían filtros de propiedad a la API (matching resiliente de nombres).              |
| 2   | Un té se incluye solo si "¿Tengo en casa?" es `true`.                                                                                                                                         |
| 3   | Un té se incluye solo si **alguna** etiqueta de su "Fase del ciclo recomendada" coincide con **alguna** etiqueta mapeada para `phase`. Para `lutea` basta `Lútea 🧘🏻‍♀️` **o** `Premenstrual 😾`. |
| 4   | Cada `Tea` expone `notion_id`, `name`, `comprovable_benefits[]`, `holistic_benefits[]`.                                                                                                       |
| 5   | `useTeas(phase)` maneja `loading` y `error` (reporta a Sentry con `domain: 'notion'`), y al cambiar `phase` refetch + resetea `currentIndex` a 0.                                             |
| 6   | `nextTea()` rota al siguiente índice de forma circular; es no-op si hay 1 o 0 tés.                                                                                                            |
| 7   | `TeaCard` muestra el nombre del té y **el primer** beneficio comprobable (`comprovable_benefits[0]`; oculto si vacío).                                                                        |
| 8   | El botón "quiero otro" solo es visible cuando hay más de un té (`canCycle` / `teas.length > 1`) y llama a `nextTea()`.                                                                        |
| 9   | Si no hay tés en casa para la fase, `TeaCard` muestra el texto `ningún té en casa para esta fase`.                                                                                            |
| 10  | El card se renderiza en Inicio **después** del indicador de fase y antes de la sección "Para hoy", usando `currentPhase` ya calculado en `Home`.                                              |

## Notas de implementación

- `TeaCard` recibe `tea: Tea \| null` (nullable para que el propio card muestre el estado vacío) más `onNext` y `canCycle`. Es una desviación menor del contrato literal `tea: Tea` del enunciado, para mantener la lógica de vacío en el componente.
- Solo React Native core + `StyleSheet`; estilos alineados con el `theme` oscuro de Inicio.
