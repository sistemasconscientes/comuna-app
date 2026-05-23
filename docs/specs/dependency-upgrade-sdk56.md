# Upgrade Expo SDK 55 → 56 y Mongoose 8 → 9

## Alcance

- **Frontend (raíz del repo):** subir Expo del SDK 55 al **SDK 56** (`expo@~56.0.4`, React Native 0.85.3, React 19.2.3) y alinear todas las libs nativas a las versiones canónicas de `bundledNativeModules.json` de la rama `sdk-56`.
- **Backend (`backend/`):** subir Mongoose **8.9.5 → ^9.6.2** y revisar tipos en `routes/stock.ts` y `models/stock.ts`.
- **Lockfile + node_modules:** regenerar desde cero porque [`package.json`](../../package.json) estaba desincronizado con [`package-lock.json`](../../package-lock.json) (declaraba RN 0.85.3 pero el lockfile estaba en 0.83.4).
- **Patch local de HealthKit:** intentar eliminar [`patches/@kingstinct+react-native-healthkit+13.3.1.patch`](../../patches/) en favor de v14.0.1 (workaround Swift 6.2 ya upstream).
- **Versionado:** bump de marketing `1.1.5 → 1.2.0` y `nativeBuild` por upgrade nativo (ver [`release-versioning.md`](./release-versioning.md)).

Fuera de alcance:

- `@sentry/react-native` 8.x (SDK 56 sigue recomendando `~7.11.0`).
- TypeScript 6.x en frontend (queda en `~5.9.2`).
- Migración de `expo-file-system` legacy → `expo-file-system/next`.

## Criterios de aceptación

| # | Criterio |
|---|----------|
| 1 | `npx expo-doctor` retorna **19/19 checks OK** sin warnings de versiones desalineadas ni peer deps faltantes. |
| 2 | `npm test` en raíz pasa al completo (incluye `version:check`). |
| 3 | `npx expo run:ios` arranca el dev client en dispositivo real sin errores nativos. |
| 4 | Smoke iOS S1–S7 de [`release-versioning.md`](./release-versioning.md) en verde: Inicio, Stock, Comidas, Salud, Perfil. |
| 5 | HealthKit lee datos (o muestra estado vacío esperado), SQLite/Drizzle abre la base local, PostHog dispara `app_open`, Sentry inicializa sin warnings. |
| 6 | Backend: `cd backend && npm run build` (tsc) limpio; `GET /stock/:notionId` y `PUT /stock/:notionId` siguen respondiendo igual contra MongoDB de prueba. |
| 7 | `npm audit --omit=dev` en raíz y en `backend/` no reporta vulnerabilidades `high`/`critical`. |
| 8 | [`package.json`](../../package.json) y [`backend/package.json`](../../backend/package.json) coinciden con el lockfile (`npm ci` reproducible). |

## Versiones objetivo — Frontend

De `bundledNativeModules.json` de la rama `sdk-56` del repo `expo/expo`. Fijar en [`package.json`](../../package.json):

| Paquete | Versión |
|---------|---------|
| `expo` | `~56.0.4` |
| `react` | `19.2.3` |
| `react-native` | `0.85.3` |
| `expo-application` | `~56.0.3` |
| `expo-dev-client` | `~56.0.13` |
| `expo-device` | `~56.0.4` |
| `expo-file-system` | `~56.0.7` |
| `expo-font` (nueva, peer de `@expo/vector-icons`) | `~56.0.5` |
| `expo-localization` | `~56.0.5` |
| `expo-sqlite` | `~56.0.3` |
| `expo-status-bar` | `~56.0.4` |
| `expo-system-ui` | `~56.0.4` |
| `react-native-gesture-handler` | `~2.31.1` |
| `react-native-safe-area-context` | `~5.7.0` |
| `react-native-svg` | `15.15.4` |
| `react-native-reanimated` | `4.3.1` |
| `react-native-worklets` | `0.8.3` |
| `@react-native-async-storage/async-storage` | `2.2.0` |
| `@sentry/react-native` | `~7.11.0` |
| `@expo/vector-icons` | `^15.0.2` (sin cambio) |
| `posthog-react-native` | `^4.45.14` |
| `@kingstinct/react-native-healthkit` | `^14.0.1` |
| `react-native-nitro-modules` | `^0.35.2` (peer de healthkit) |
| `babel-plugin-dotenv-import` | `^3.0.1` (sin cambio) |
| `babel-plugin-inline-import` | `^3.0.0` (sin cambio) |
| `babel-preset-expo` | `~56.0.12` |
| `drizzle-orm` | `^0.45.1` (sin cambio) |
| `jest-expo` | `~56.0.4` |
| `@types/jest` | `29.5.14` (sin cambio) |
| `@types/react` | `~19.2.2` |
| `drizzle-kit` | `^0.31.10` (sin cambio) |
| `patch-package` | `^8.0.1` (sin cambio) |
| `typescript` | `~5.9.2` (no subir a 6.x en esta tanda) |

## Versiones objetivo — Backend

| Paquete | Antes | Después |
|---------|-------|---------|
| `mongoose` | `^8.9.5` | `^9.6.2` |
| `express` | `^5.2.1` | `^5.2.1` (sin cambio) |
| `dotenv` | `^16.4.5` | `^16.4.5` (sin cambio) |
| `@types/express` | `^5.0.6` | `^5.0.6` |
| `@types/node` | `^25.9.1` | `^25.9.1` |
| `ts-node-dev` | `^2.0.0` | `^2.0.0` |
| `typescript` | `^6.0.3` | `^6.0.3` |

## Breaking changes detectados

### Mongoose 9

- Tipos de retorno de `findOneAndUpdate(..., { new: true }).lean()` se endurecen. Revisar [`backend/src/routes/stock.ts`](../../backend/src/routes/stock.ts:62) y ajustar el `if (!doc)` y casts si TS rompe.
- `runValidators` + `upsert` son más estrictos con tipos parciales.
- `mongoose.connect(uri, { appName })` sigue válido; no requiere cambios en [`backend/src/db.ts`](../../backend/src/db.ts).

### Expo / RN

- **RN 0.85**: New Architecture activa por defecto. Revisar `App.tsx` por usos directos de turbomódulos o native modules deprecados.
- **Reanimated 4.3.x**: drop-in desde 4.2.x; el plugin Babel lo provee `babel-preset-expo`.
- **`expo-file-system`**: la API legacy sigue funcionando en SDK 56; no se fuerza migración a `/next`.
- **`@expo/vector-icons` 15**: requiere `expo-font` como peer instalada explícitamente (lo agregamos).

### Patch HealthKit

- El patch actual workaroundea `Bool(fromCxx: cachedCxxPart)` (Swift 6.2 + nitrogen) en v13.3.1. En v14.x el codegen upstream ya lo soluciona. Si tras `npx expo prebuild --clean && npx expo run:ios` no aparece el error de Xcode, **eliminar el patch**. Si reaparece, regenerar con `npx patch-package @kingstinct/react-native-healthkit` para v14.0.1.

## Plan de ejecución

1. **Spec primero** (este documento).
2. Backup mental de [`package.json`](../../package.json) y [`package-lock.json`](../../package-lock.json) (git da el rollback).
3. Editar [`package.json`](../../package.json) con las versiones objetivo.
4. `rm -rf node_modules package-lock.json .expo ios android`.
5. `npm install`.
6. `npx expo-doctor` → debe quedar verde.
7. Eliminar patch healthkit 13.3.1; `npx expo prebuild --clean` y `npx expo run:ios`. Si Xcode falla con el error Swift 6.2 nitrogen, regenerar patch para 14.0.1.
8. Backend: editar [`backend/package.json`](../../backend/package.json), reinstalar, correr `tsc`, ajustar tipos si aplica, smoke test endpoints.
9. `npm audit` en ambos paquetes; fix de `high`/`critical`.
10. `npm test` en raíz (verde).
11. Actualizar [`npm-deprecation-warnings.md`](./npm-deprecation-warnings.md) reflejando que los `overrides` de `rimraf`/`glob` pueden retirarse si el árbol SDK 56 ya no los necesita.
12. Bump `version` `1.1.5 → 1.2.0`, `npm run version:bump:native`, `npm run version:sync`, `npm run version:check`.

## Validación post-merge

- TestFlight build con perfil `preview` y smoke S1–S7 de [`release-versioning.md`](./release-versioning.md).
- Verificar en Sentry que la nueva versión `1.2.0` aparece sin errores nativos de arranque.
- Verificar en PostHog que el evento `app_open` llega con `app_version: 1.2.0`.
