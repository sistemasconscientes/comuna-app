# Warnings de `npm` (paquetes deprecados)

## Alcance

Documentar el origen de los avisos `npm warn deprecated` y `npm audit` al instalar dependencias, qué se ha hecho en el repo para **reducir** el ruido sin romper Jest/Metro/Expo, y qué queda en manos de **upstream** (Expo, React Native, Jest, drizzle-kit).

Actualizado para Expo **SDK 56** (ver [`dependency-upgrade-sdk56.md`](./dependency-upgrade-sdk56.md)).

## Criterios de aceptación

| # | Criterio |
|---|----------|
| 1 | Tras `rm -rf node_modules && npm install`, no debe aparecer el aviso de `rimraf@3` ni el de `glob@10.5.x` arrastrado por la cadena `chromium-edge-launcher` → `rimraf` (resuelto con `overrides` en [`package.json`](../../package.json)). |
| 2 | Las dependencias alineadas con Expo SDK 55 deben coincidir con lo que valida `npx expo-doctor` (salvo exclusiones explícitas en `expo.install.exclude`). |
| 3 | `npm test` debe seguir pasando al completo. |
| 4 | Los avisos que sigan saliendo por `glob@7` + `inflight` (Jest 29, React Native codegen) o por drizzle-kit / stack de tests están **documentados** como dependencia de versiones futuras de esas herramientas. |

## Diagnóstico (`npm ls` / `npm why`)

Resumen del árbol relevante:

- **`@xmldom/xmldom`**: en la práctica **0.8.x** vía `@expo/plist` / `plist` (no 0.7.x en el lock actual).
- **`rimraf@3`**: antes en `chromium-edge-launcher` (dev middleware de React Native bajo `@expo/cli`).
- **`glob@7.2.3` + `inflight`**: `react-native` / `@react-native/codegen` y **Jest 29** (`jest-config`, `jest-runtime`, `test-exclude`, etc.). Forzar `glob` moderno en todo el árbol **rompe** Jest si no migran de API.
- **`tar` / `lodash.get`**: pueden no aparecer en un lock concreto; si aparecen en otro entorno, localizar con `npm why <paquete>`.

## Acciones aplicadas en el proyecto

1. **Alineación con Expo SDK 56** (canónica desde `bundledNativeModules.json` de la rama `sdk-56`): `expo`, `react`, `react-native`, todos los `expo-*`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-svg`, `react-native-reanimated`, `react-native-worklets`, `jest-expo`, `babel-preset-expo`, `@react-native-async-storage/async-storage`, `@sentry/react-native`.
2. **`expo-font` agregada explícitamente** como peer requerida por `@expo/vector-icons`.
3. **`expo-splash-screen` plugin**: en SDK 56 la key `expo.splash` top-level se eliminó del schema; la configuración vive ahora en el plugin (ver [`splash-screen.md`](./splash-screen.md)).
4. **`expo.install.exclude: ["typescript"]`** en [`package.json`](../../package.json): silencia el aviso de `expo-doctor` por dejar TS en `~5.9.2` (no subir a 6.x hasta nueva tanda).
5. **`overrides` en `package.json`**: subir `rimraf` a 5.x y forzar el `glob` hijo de `rimraf` a **13.x**, eliminando la cadena `rimraf@3` → `glob@10.5.0` deprecada.
6. **Patch HealthKit**: regenerado para `@kingstinct/react-native-healthkit@14.0.1` (workaround Swift 6.2 nitrogen sigue siendo necesario en v14).

## Avisos que pueden seguir apareciendo

### `npm warn deprecated`

- **`glob@7.2.3`**, **`inflight`**: Jest 29 y React Native hasta que actualicen dependencias.
- **`@esbuild-kit/*`**: suele venir de **drizzle-kit**; se resuelve cuando drizzle-kit deje de depender de ese stack.
- **`whatwg-encoding`**, **`abab`**, **`domexception`**: típico del stack de tests / entorno JS emulado; depende de actualizaciones de Jest y dependencias relacionadas.
- **`uuid@7.0.3`**: arrastrado por `xcode` → `@expo/config-plugins` (Expo CLI).

### `npm audit` — vulnerabilidades transitivas

Post-SDK 56 quedan **16 moderate** en raíz, **0** en backend. Todas transitivas y de dev/CLI:

| Cadena | Causa | Espera fix de |
|--------|-------|---------------|
| `drizzle-kit` → `@esbuild-kit/esm-loader` → `esbuild ≤0.24.2` | GHSA-67mh-4wv8-2f99 | Drizzle migre a `tsx` o suba `esbuild`. |
| `expo`, `expo-splash-screen`, `@sentry/react-native` → `@expo/config-plugins` → `xcode` → `uuid <11.1.1` | GHSA-w5hq-g745-h8pq | Expo bumpee `xcode` en `@expo/config-plugins`. |

**No** se aplica `npm audit fix --force`: bajaría `drizzle-kit` a `0.18.1` y `expo` a `46.x` (breaking). Ninguna es `high`/`critical`, así que el criterio de aceptación del upgrade (no `high`/`critical`) sigue verde.

## Ocultar salida (solo cosmético)

No sustituye actualizar dependencias. Si en CI solo se quiere menos ruido, se puede usar `loglevel=error` en `.npmrc` o en el comando de instalación; **oculta otros avisos útiles** además de los deprecados.

## Validación realizada

- `npm test`: todas las suites en verde (80/80 tras upgrade SDK 56).
- `npx expo-doctor`: **21/21 checks** OK tras alinear todas las libs nativas con el bundled de SDK 56, agregar `expo-font` y mover splash al plugin.
- `cd backend && npm run build`: tsc limpio con Mongoose 9.
- `npm audit` en backend: 0 vulnerabilidades.

## Build iOS

Este repositorio no incluye la carpeta `ios/` versionada; la comprobación nativa típica es `npx expo run:ios` (o `expo prebuild` + Xcode) en la máquina de desarrollo tras un `npm install`.
