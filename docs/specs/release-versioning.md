# Versionado de releases (app.json, package.json, EAS)

## Alcance

- **Plataforma:** el proyecto **solo distribuye iOS** (TestFlight / App Store) hasta nuevo aviso. Lo operativo es **`nativeBuild` → `ios.buildNumber`**. El bloque `android` en `app.json` y `android.versionCode` se mantienen alineados con `nativeBuild` solo por **coherencia con Expo** y un único `version:check`; **no hay releases Android** planificados.
- **Versión de marketing (semver en `package.json`):** formato **`X.Y.Z` = versión · hito · feature** (tres números, sin prerelease en el flujo automatizado):
  - **X** — versión mayor de producto (manual).
  - **Y** — milestone (manual).
  - **Z** — contador de **features** publicables; sube con **`npm run version:bump:feature`** al cerrar una feature que vaya a build.
- **`nativeBuild`** (entero ≥ 1, canónico en `package.json`): se copia a `ios.buildNumber` (string) y `android.versionCode` vía [`scripts/sync-version.js`](../../scripts/sync-version.js). Debe **subir al menos en 1** en cada binary que subas a **TestFlight** (Apple exige build number creciente).
- **EAS Build:** [`eas.json`](../../eas.json) usa `appVersionSource: "local"`. **No** se usa `autoIncrement` en los perfiles para semver; el bump de **`nativeBuild` en perfil `preview`** lo hace **`eas-build-pre-install`** (ver más abajo).

## Anti‑patrón (evitar)

- **No** bump de release editando solo [`app.json`](../../app.json). La fuente canónica es [`package.json`](../../package.json) (`version`, `nativeBuild`); después `npm run version:sync`. Si el diff del PR solo muestra `app.json` y no `package.json`, CI fallará en `version:check` (o `npm test`) hasta alinear ambos en el mismo cambio.

## Cuándo subir qué

| Acción | Cuándo |
|--------|--------|
| **`npm run version:bump:feature`** | Nueva feature publicable: sube solo **Z** (`1.2.5` → `1.2.6`). **X** e **Y**: editarlos a mano cuando cambie release o milestone. |
| **`npm run version:bump:native`** | Antes de un preview local o para alinear el repo tras un build en la nube (ver Preview). |
| Editar **`nativeBuild`** a mano | Alternativa al comando anterior; luego `npm run version:sync`. |

No es obligatorio subir **Z** en cada PR interno: sí cuando el cambio forma parte de un **release** que se va a construir y distribuir (TestFlight, etc.).

## Checklist antes de merge (release)

| # | Criterio |
|---|----------|
| R1 | `package.json` → `version` (`X.Y.Z`) y `nativeBuild` (entero ≥ 1) actualizados según el release. |
| R2 | Ejecutar `npm run version:sync` para propagar a `app.json`: `expo.version`, `ios.buildNumber`, `android.versionCode`. |
| R3 | **`npm run version:check`** debe pasar (o **`npm test`**, que lo ejecuta antes de Jest). |
| R4 | `package.json` y `expo.version` iguales; `nativeBuild` coincide con `ios.buildNumber` (string) y `android.versionCode` (número). |
| R5 | Tras `eas build`, verificar en el binario / TestFlight que versión de marketing y build nativo coinciden con lo esperado. |

## Comandos

| Comando | Descripción |
|---------|-------------|
| **`npm run version:sync`** | Escribe `app.json` desde `package.json`. |
| **`npm run version:check`** | Valida alineación (CI / inicio de `npm test`). |
| **`npm run version:bump:feature`** | `Z` + 1 y sync. Requiere `version` en forma `X.Y.Z` numérica. |
| **`npm run version:bump:native`** | `nativeBuild` + 1 y sync. |
| **`npm run eas:build:preview`** | `version:bump:native` y luego `eas build --profile preview` (deja el bump en el commit si corrés esto antes de push). |

### Automático (EAS)

- **`eas-build-pre-install`:** si `EAS_BUILD_PROFILE` es **`preview`**, ejecuta **`version:bump:native`** en el worker **antes** de `npm ci`. Cada preview en la nube usa un **`nativeBuild`** distinto en el binary, evitando rechazos por mismo build number en TestFlight.
- **`eas-build-post-install`:** `npm run version:sync` tras `npm ci`. Si el commit trae `package.json` actualizado y `app.json` viejo, el build alinea `app.json`.

**Repo vs nube:** el bump en **preview remoto** modifica `package.json` solo en el filesystem del build; **no hace commit**. Para que `main` refleje el último `nativeBuild`, hacé **`npm run version:bump:native`** (y commit) antes de pushear, o alineá a mano tras varios previews.

### Lifecycle `version` (npm)

Tras `npm version patch|minor|major`, si tenés hook `version` en `package.json`, puede ejecutarse `version:sync`. Para el esquema **versión.hito.feature**, el flujo recomendado es **`npm run version:bump:feature`** en lugar de `npm version patch`, salvo que quieras subir **minor/major** con `npm version` y luego ajustar a tu convención.

## EAS

- **`appVersionSource: "local"`** — Semver y números nativos vienen del proyecto (o del bump en pre-install en preview).
- **Sin `autoIncrement`** en `eas.json` para reemplazar `nativeBuild`; el incremento en preview está en **`eas-preview-bump-native.js`**.

## Opcional (futuro)

- Mostrar versión instalada en Perfil con `expo-application` — fuera de alcance hasta que se defina UI.

## En specs con «Cierre de feature»

Si el PR incluye bump de app: seguir este documento y el checklist R1–R4 (incluye `nativeBuild` cuando vaya a TestFlight).
