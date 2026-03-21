# Warnings de `npm` (paquetes deprecados)

## Alcance

Documentar el origen de los avisos `npm warn deprecated` al instalar dependencias, qué se ha hecho en el repo para **reducir** el ruido sin romper Jest/Metro, y qué queda en manos de **upstream** (Expo, React Native, Jest, drizzle-kit).

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

1. **Alineación con Expo SDK 55** (`npx expo install`): `expo-dev-client`, `jest-expo`, `react-native-worklets`, `@types/jest` en las versiones que recomienda el SDK.
2. **`overrides` en `package.json`**: subir `rimraf` a 5.x y forzar el `glob` hijo de `rimraf` a **13.x** (alineado con el `glob` que ya usa Expo), eliminando la cadena `rimraf@3` → `glob@10.5.0` deprecada.

## Avisos que pueden seguir apareciendo

- **`glob@7.2.3`**, **`inflight`**: Jest 29 y React Native hasta que actualicen dependencias.
- **`@esbuild-kit/*`**: suele venir de **drizzle-kit**; se resuelve cuando drizzle-kit deje de depender de ese stack.
- **`whatwg-encoding`**, **`abab`**, **`domexception`**: típico del stack de tests / entorno JS emulado; depende de actualizaciones de Jest y dependencias relacionadas.

## Ocultar salida (solo cosmético)

No sustituye actualizar dependencias. Si en CI solo se quiere menos ruido, se puede usar `loglevel=error` en `.npmrc` o en el comando de instalación; **oculta otros avisos útiles** además de los deprecados.

## Validación realizada

- `npm test`: todas las suites en verde.
- `npx expo-doctor`: comprobación de versiones del SDK OK; puede seguir avisando de peers opcionales (p. ej. `react-native-svg` para PostHog) según el [`package.json`](../../package.json).

## Build iOS

Este repositorio no incluye la carpeta `ios/` versionada; la comprobación nativa típica es `npx expo run:ios` (o `expo prebuild` + Xcode) en la máquina de desarrollo tras un `npm install`.
