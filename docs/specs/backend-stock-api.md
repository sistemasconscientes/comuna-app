# Spec: API backend Stock (Express + MongoDB)

**Ubicación:** [`backend/`](../../backend/)  
**Entry:** `backend/src/server.ts`  
**Modelo:** `backend/src/models/stock.ts`  
**Rutas:** `backend/src/routes/stock.ts`

---

## Alcance

- Servidor HTTP standalone (Node.js + Express 4 + Mongoose 8 + TypeScript) que persiste estado de stock por suplemento Notion (`notionId` único).
- No integración con la app React Native en esta fase.

Fuera de alcance: autenticación, CORS explícito, cliente móvil.

---

## Variables de entorno

| Variable       | Descripción                          |
|----------------|--------------------------------------|
| `MONGODB_URI`  | URI de conexión MongoDB (obligatoria) |
| `appName`      | Nombre de aplicación para el driver (ej. `sistemasconscientes`) |
| `PORT`         | Puerto HTTP (default `3000`)        |

Carga (`backend/src/loadEnv.ts`): primero el `.env` en la **raíz del monorepo**, luego `backend/.env` (puede sobrescribir). Así `npm run dev` en `backend/` usa el mismo `MONGODB_URI` que la app sin duplicar secretos.

No versionar `.env`; opcional: solo raíz, solo `backend/.env`, o ambos.

---

## Modelo `Stock`

| Campo            | Tipo     | Notas                          |
|------------------|----------|--------------------------------|
| `notionId`       | string   | Único (índice `unique: true`)  |
| `bottleOpenedAt` | Date     | Fecha de apertura del frasco   |
| `totalPills`     | number   | Total de pastillas al abrir    |
| `pillsPerDay`    | number   | Pastillas por día              |
| `restockFlagged` | boolean  | Ya se marcó recompra en Notion |
| `updatedAt`      | Date     | Última actualización           |

---

## Endpoints

### `GET /stock/:notionId`

- Busca por `notionId`.
- **404** con body `{ "error": "not found" }` si no existe.
- **200** con el documento completo (incl. `_id` de MongoDB) si existe.

### `PUT /stock/:notionId`

- Body JSON opcional: `bottleOpenedAt`, `totalPills`, `pillsPerDay`, `restockFlagged`.
- **Upsert:** crea si no existe, actualiza si existe.
- Siempre establece `updatedAt` a la fecha/hora actual del servidor.
- En **creación** (insert), si un campo opcional no viene en el body: `bottleOpenedAt` → ahora; `totalPills` y `pillsPerDay` → `0`; `restockFlagged` → `false`.
- **200** con el documento guardado tras la operación.

`bottleOpenedAt` puede enviarse como string ISO; debe persistirse como fecha coherente.

---

## Criterios de aceptación

| ID | Criterio |
|----|----------|
| BS1 | `notionId` es único en la colección; violación de unicidad manejada de forma razonable (no crashea el proceso). |
| BS2 | `GET` devuelve 404 + `{ error: "not found" }` cuando no hay documento. |
| BS3 | `PUT` hace upsert y devuelve el documento actualizado con `updatedAt` reciente. |
| BS4 | Conexión a MongoDB loguea éxito (`MongoDB connected`) o error en fallo. |
| BS5 | Servidor escucha en `PORT` o 3000 por defecto; arranque solo tras conectar a la base. |

---

## Escenarios (Gherkin)

```gherkin
Scenario: Obtener stock inexistente
  When el cliente hace GET a "/stock/id-inexistente"
  Then la respuesta tiene status 404
  And el body contiene "not found"

Scenario: Crear o actualizar stock con PUT
  When el cliente hace PUT a "/stock/notion-abc" con body JSON válido
  Then la respuesta tiene status 200
  And el documento incluye notionId "notion-abc" y updatedAt reciente
```
