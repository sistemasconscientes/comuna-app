# Notion — meal prep activo (`getMealPrep`)

## Alcance

`getMealPrep()` en `src/api/notion.ts` obtiene el **plan de comidas activo** publicado en Notion: página hija bajo la sección **Comidas Activas** de una página hub configurada por entorno, y **todos** los bloques hijos directos de esa página del plan vía `listBlockChildrenAll` (sin `table_row` bajo tablas; la pantalla Comidas expande con `expandMealPrepNotionBlocks` y un callback `fetch` + `NOTION_API_KEY`, ver [`meal-prep-screen.md`](./meal-prep-screen.md)).

## Variable de entorno

| Variable                       | Descripción                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NOTION_MEAL_PREP_HUB_PAGE_ID` | **Opcional.** ID de la página de Notion que contiene el bloque `heading_2` con título **Comidas Activas** (p. ej. página “Cocina y Comida”). Si está vacío o ausente, `getMealPrep` devuelve **`null`** (la pestaña Comidas muestra “Sin plan…” sin lanzar). |

No se hardcodean IDs de páginas en código.

## Flujo (API)

1. `GET /blocks/{hub_id}/children` — paginación completa hasta obtener todos los hijos directos del hub.
2. Localizar el primer bloque `heading_2` cuyo texto plano (rich text unido, `.trim()`) sea exactamente **`Comidas Activas`**.
3. Recorrer los bloques **posteriores** en orden; tomar el **primer** bloque `child_page`.
4. `GET /blocks/{child_page.id}/children` con paginación completa (`listBlockChildrenAll`) — solo un nivel: hijos directos de la página del plan.
5. Retornar `{ title: child_page.title, pageId: block.id, blocks }` o `null` si no hay heading o no hay `child_page` después.

## Criterios de aceptación

| #   | Criterio                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Solo coincide el heading si `type === 'heading_2'` y el texto es exactamente `Comidas Activas` (tras trim).                                                                 |
| 2   | El plan activo es el **primer** `child_page` que aparece **después** de ese heading en la lista de hijos del hub (se ignoran bloques intermedios que no sean `child_page`). |
| 3   | `blocks` incluye **todos** los hijos directos de la página del plan (sin `table_row` anidadas bajo cada `table`).                                                           |
| 4   | Si no existe el heading o no hay ningún `child_page` después, la función devuelve **`null`** (no lanza).                                                                    |
| 5   | Falta `NOTION_API_KEY`: se lanza al llamar a la API. Falta o está vacío `NOTION_MEAL_PREP_HUB_PAGE_ID`: `getMealPrep` devuelve **`null`** (no `requireEnv`).                |
| 6   | Errores de red o respuestas HTTP de error de Notion se propagan como en el resto del cliente.                                                                               |

## Firma

```ts
export async function getMealPrep(): Promise<{
  title: string;
  pageId: string;
  blocks: any[];
} | null>;
```
