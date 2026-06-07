# Suplementos Notion — filtro por Temporada (cliente)

## Alcance

`getSupplements` en `src/api/notion.ts` obtiene páginas de la base de Notion (filtro API: disponible + persona) y **después** reduce la lista en cliente según la propiedad **Temporada** / **Season**, el **mes local** del dispositivo y la **fase actual** del usuario (`currentPhase`).

## Criterios de aceptación

| #   | Criterio                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Se incluye siempre un suplemento si algún valor de Temporada coincide con **"Todo el año"** (comparación insensible a mayúsculas y tildes).                                                        |
| 2   | Se incluye si algún valor de Temporada es **Q1–Q4** y el trimestre coincide con el mes actual local: Q1 → meses 1–3, Q2 → 4–6, Q3 → 7–9, Q4 → 10–12 (acepta variantes con espacios, p. ej. `Q 1`). |
| 3   | Se incluye si algún valor es **"Fase folicular"** y `currentPhase` normaliza a fase **folicular**.                                                                                                 |
| 4   | Se incluye si algún valor es **"Fase lútea"** y `currentPhase` normaliza a fase **lútea**.                                                                                                         |
| 5   | En cualquier otro caso se **excluye** el suplemento (incluido Temporada vacía o valores no reconocidos).                                                                                           |
| 6   | Si Temporada es multi-select o texto con varias etiquetas separadas por comas, basta que **una** etiqueta cumpla las reglas 1–4 para incluir.                                                      |
| 7   | La prioridad entre texto plano y multi-select para listar etiquetas coincide con la ya usada para construir `seasonRaw` (texto si existe; si no, valores del multi-select).                        |
| 8   | `normalizePhase(currentPhase)` (misma util que el resto de la app) determina folicular/lútea; si la fase no se puede normalizar, solo aplican reglas de año completo y trimestre.                  |

## Firma

- `getSupplements(user, currentPhase: string, applyTemporadaFilter?: boolean)` — `currentPhase` obligatorio (puede ser `''`); tercer argumento default `true`. Con `applyTemporadaFilter === false` se devuelven **todos** los suplementos (mismo filtro Notion de persona/disponible), sin recorte por Temporada; cada ítem lleva `temporadaLabels` para filtrar en la app.

## Pantalla Stock

| #   | Criterio                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | `useSupplements(..., { applyTemporadaFilter: false })` para cargar inventario completo y sincronizar SQLite con todas las filas devueltas.                                                                                           |
| S2  | La lista muestra por defecto **Todas** las filas; el usuario puede elegir **Temporada actual** y ver solo las que cumplen la misma regla OR que `getSupplements` con filtro activo (mes local + `cyclePhase` desde `useHealthData`). |
| S3  | Alertas de bajo stock y `markForRestock` siguen evaluando **todo** el inventario cargado, no solo la lista filtrada.                                                                                                                 |

## Notas

- No se añaden filtros OR adicionales en el body de la query de Notion por Temporada; el filtrado es **solo en cliente** tras la query paginada existente.
- La lógica OR por etiqueta vive en `src/utils/temporadaFilter.ts` y la reutilizan `getSupplements` y la vista Stock.
