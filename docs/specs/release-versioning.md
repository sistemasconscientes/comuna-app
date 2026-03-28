# Versionado de releases (app.json, package.json, EAS)

## Alcance

- **Versión de marketing (semver):** `version` en [`package.json`](../../package.json) (canónico) y `expo.version` en [`app.json`](../../app.json) — se alinean con `npm run version:sync`.
- **Build nativos (por release / feature publicable):** un solo entero **`nativeBuild`** en [`package.json`](../../package.json) (canónico). El script [`scripts/sync-version.js`](../../scripts/sync-version.js) lo copia a `ios.buildNumber` (string) y `android.versionCode` (entero) en [`app.json`](../../app.json). Debe **subir al menos en 1** en cada release que suba a TestFlight / tiendas (Apple y Google exigen secuencia creciente).
- **EAS Build:** [`eas.json`](../../eas.json) usa `appVersionSource: "local"`. **No** se usa `autoIncrement` en los perfiles: los números nativos salen del repo, no de incrementos automáticos en la nube.

## Anti‑patrón (evitar)

- **No** bump de release editando solo [`app.json`](../../app.json) (`expo.version`, `ios.buildNumber`, `android.versionCode`). La fuente canónica es [`package.json`](../../package.json) (`version`, `nativeBuild`); después `npm run version:sync`. Si el diff del PR solo muestra `app.json` y no `package.json`, CI fallará en `version:check` (o `npm test`) hasta alinear ambos en el mismo cambio.

## Cuándo subir versión

Alineado con `.cursor/rules/spec-driven.mdc` para cambios observables que se publican:

| Bump | Cuándo |
|------|--------|
| **patch** | Fixes, ajustes de UI, correcciones sin cambiar el contrato de la app. |
| **minor** | Nueva feature de usuario o comportamiento nuevo claramente identificable. |
| **major** | Ruptura explícita (p. ej. cambio de flujo que obligue a reentrenar usuarios); uso poco frecuente. |

No es obligatorio subir versión en cada PR interno: sí cuando el cambio forma parte de un **release** que se va a construir y distribuir (TestFlight, store, etc.).

## Checklist antes de merge (release)

| # | Criterio |
|---|----------|
| R1 | `package.json` → `version` (semver) y `nativeBuild` (entero ≥ 1) actualizados según el release. |
| R2 | Ejecutar `npm run version:sync` para propagar a `app.json`: `expo.version`, `ios.buildNumber`, `android.versionCode`. |
| R3 | **`npm run version:check`** debe pasar (o **`npm test`**, que lo ejecuta antes de Jest): valida que `app.json` no se desalinee de `package.json`. |
| R4 | Confirmar semver: `package.json` y `expo.version` iguales; `nativeBuild` coincide con `ios.buildNumber` (como string) y `android.versionCode` (como número). |
| R5 | Tras `eas build`, verificar en el binario / tiendas que versión de marketing y build nativo coinciden con el commit. |

**Features publicables:** al cerrar una feature que vaya a build de tienda/TestFlight, incluir en el mismo PR el bump R1–R2 y que R3 sea verde; el check automático evita olvidar sincronizar `app.json` tras editar `package.json`.

## Comandos

- **`npm run version:sync`** — Lee `package.json` y escribe en `app.json`: `expo.version`, `ios.buildNumber`, `android.versionCode`. Ejecutar tras cambiar `version` y/o `nativeBuild`.
- **`npm run version:check`** — Solo lectura: falla con código distinto de 0 si `app.json` no refleja `version` y `nativeBuild` de `package.json`. Incluido al inicio de **`npm test`**.

Flujo típico al cerrar una feature con bump:

```bash
npm version patch --no-git-tag-version   # o minor / major
# Editar package.json: subir "nativeBuild" en +1 si este build va a tienda/TestFlight
npm run version:sync
git add package.json app.json package-lock.json
```

(`package-lock.json` puede cambiar si `npm version` lo toca; commitear según el flujo del equipo.)

## EAS

- **`appVersionSource: "local"`** — Semver y números nativos vienen del proyecto en disco.
- **Sin `autoIncrement`** — Evita desalinear lo commitado con lo que genera EAS en la nube; el incremento de `nativeBuild` es explícito en cada release.

## Opcional (futuro)

- Mostrar versión instalada en Perfil con `expo-application` — fuera de alcance de este spec hasta que se defina UI.

## En specs con «Cierre de feature»

Si el PR incluye bump de app: seguir este documento y el checklist R1–R4 (incluye `nativeBuild`).
