# Versionado de releases (app.json, package.json, EAS)

## Alcance

- **Versión de marketing (semver):** `version` en [`package.json`](../../package.json) (canónico) y `expo.version` en [`app.json`](../../app.json) — deben coincidir antes de mergear un release.
- **EAS Build:** [`eas.json`](../../eas.json) usa `appVersionSource: "local"`: cada `eas build` toma el semver desde el proyecto en disco (vía Expo config), alineado con git.
- **Números de build nativos:** `production.autoIncrement: true` en `eas.json` incrementa **iOS build number** / **Android versionCode** por build. Es independiente del semver (usuario ve 1.2.3; App Store puede llevar build 42).

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
| R1 | `package.json` → `version` actualizado al semver acordado (fuente canónica). |
| R2 | Ejecutar `npm run version:sync` para copiar ese valor a `app.json` → `expo.version`. |
| R3 | Confirmar que ambos archivos muestran el mismo string (p. ej. `1.2.3`). |
| R4 | Tras `eas build`, verificar en el binario que la versión visible (p. ej. TestFlight / Ajustes) coincide con el commit. |

## Comandos

- **`npm run version:sync`** — Copia `version` de `package.json` a `expo.version` en `app.json`. Ejecutar tras `npm version patch|minor|major` o tras editar a mano `package.json`.

Flujo típico al cerrar una feature con bump:

```bash
npm version patch --no-git-tag-version   # o minor / major
npm run version:sync
git add package.json app.json package-lock.json
```

(`package-lock.json` puede cambiar si `npm version` lo toca; commitear según el flujo del equipo.)

## EAS: local vs build number

- **`appVersionSource: "local"`** — El semver del build sale del repo; no depende solo del dashboard de EAS.
- **`autoIncrement` (perfil production)** — Solo incrementa el contador nativo por build; no sustituye el semver.

## Opcional (futuro)

- Mostrar versión instalada en Perfil con `expo-application` — fuera de alcance de este spec hasta que se defina UI.

## En specs con «Cierre de feature»

Si el PR incluye bump de app: seguir este documento y el checklist R1–R3.
