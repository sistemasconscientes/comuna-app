# Spec: API backend Stock (Express + MongoDB)

**Ubicación:** [`backend/`](../../backend/)  
**Entry:** `backend/src/server.ts`  
**Modelo:** `backend/src/models/stock.ts`  
**Rutas:** `backend/src/routes/stock.ts`  
**Auth:** [`backend/src/middleware/apiKey.ts`](../../backend/src/middleware/apiKey.ts)

---

## Alcance

- Servidor HTTP standalone (Node.js + Express 4 + Mongoose 8 + TypeScript) que persiste estado de stock por suplemento Notion (`notionId` único).
- **Cliente móvil:** la app React Native usa `GET`/`PUT /stock/:notionId` con header `x-api-key` para suplementos con **Persona = Ambas** en Notion (stock compartido en MongoDB). Suplementos con Persona Diana o Estefanía siguen usando SQLite en el dispositivo.

Fuera de alcance explícito: CORS (el cliente es nativo).

### Cliente móvil: URL del API (`EXPO_PUBLIC_BACKEND_URL`)

- La app no conoce `MONGODB_URI`; solo llama a `GET`/`PUT` bajo `{EXPO_PUBLIC_BACKEND_URL}/stock/:notionId`.
- **Desarrollo local (Metro + dispositivo en la misma red):** en `.env` de la raíz, `EXPO_PUBLIC_BACKEND_URL=http://<IP_LAN_DEL_MAC>:3000` (sin barra final). En el Mac, `backend/.env` usa `MONGODB_URI` apuntando a una base Mongo de **prueba**.
- **Build EAS `preview`** (ambiente “productivo” interno): [`eas.json`](../../eas.json) define `EXPO_PUBLIC_BACKEND_URL` al host desplegado (p. ej. Render). En el dashboard de ese servicio, `MONGODB_URI` debe apuntar a la base **preview** (o la que usen las dos usuarias).
- **Build EAS `development` en la nube:** si no inyectás `EXPO_PUBLIC_BACKEND_URL` (secret o `eas.json`), el stock compartido quedará deshabilitado hasta que la definas.
- Si falta `EXPO_PUBLIC_BACKEND_URL`, `getSharedStock` devuelve `null` (warning en consola) y `updateSharedStock` lanza error.

---

## Autenticación

- Todas las rutas bajo `/stock` requieren header **`x-api-key`** cuyo valor debe coincidir con la variable de entorno **`API_KEY`** del servidor.
- Si falta el header, no coincide el valor, o **`API_KEY`** no está definida en el proceso: respuesta **401** con body `{ "error": "Unauthorized" }`.

### Despliegue (Render)

- En el dashboard del servicio, definir **`API_KEY`** con el mismo valor que **`BACKEND_API_KEY`** en la app (EAS / `.env` local).

---

## Variables de entorno

| Variable       | Descripción                          |
|----------------|--------------------------------------|
| `MONGODB_URI`  | URI de conexión MongoDB (obligatoria) |
| `appName`      | Nombre de aplicación para el driver (ej. `<YOUR_MONGODB_APP_NAME>`) |
| `PORT`         | Puerto HTTP (default `3000`)        |
| `API_KEY`      | Secreto compartido con la app; obligatorio para usar `/stock` en producción |

Carga (`backend/src/loadEnv.ts`): solo `backend/.env` (resuelto con `path.resolve(__dirname, '../.env')` desde `src/`).

Generar una clave segura localmente:

```bash
openssl rand -hex 32
```

Añadir en `backend/.env`:

```bash
API_KEY=<valor de openssl rand -hex 32>
```

No versionar `.env`.

### App móvil (`.env` y EAS)

- **`EXPO_PUBLIC_BACKEND_URL`:** ver sección anterior; en local va en `.env`; en `preview` puede ir en `eas.json` `build.preview.env` o en variables de entorno EAS del perfil.
- **`BACKEND_API_KEY`:** debe coincidir con **`API_KEY`** del backend al que apunte la URL anterior. Para builds en la nube, crear el secreto de proyecto (ajustar perfil si hace falta):

```bash
eas secret:create --scope project --name BACKEND_API_KEY --value "<mismo valor que API_KEY en Render>"
```

(En versiones recientes del CLI también existe `eas env:create` con flags similares; usar `eas env --help` si el comando anterior no aplica.)

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

- Requiere `x-api-key` válido.
- Busca por `notionId`.
- **404** con body `{ "error": "not found" }` si no existe.
- **200** con el documento completo (incl. `_id` de MongoDB) si existe.

### `PUT /stock/:notionId`

- Requiere `x-api-key` válido.
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
| BS6 | Sin `x-api-key` correcto, `GET`/`PUT` bajo `/stock` responden 401 + `{ error: "Unauthorized" }`. |
| BS7 | Con `EXPO_PUBLIC_BACKEND_URL` vacío en el cliente, no se hacen peticiones de stock compartido con URL inválida (`getSharedStock` null, `updateSharedStock` error explícito). |

---

## Escenarios (Gherkin)

```gherkin
Scenario: Obtener stock inexistente
  When el cliente hace GET a "/stock/id-inexistente" con x-api-key válido
  Then la respuesta tiene status 404
  And el body contiene "not found"

Scenario: Sin autenticación
  When el cliente hace GET a "/stock/cualquier-id" sin x-api-key o con clave incorrecta
  Then la respuesta tiene status 401
  And el body contiene "Unauthorized"

Scenario: Crear o actualizar stock con PUT
  When el cliente hace PUT a "/stock/notion-abc" con body JSON válido y x-api-key válido
  Then la respuesta tiene status 200
  And el documento incluye notionId "notion-abc" y updatedAt reciente
```
