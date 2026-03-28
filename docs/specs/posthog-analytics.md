# Spec: PostHog — analítica de producto

**Estado:** implementado  
**Errores y logging:** Sentry ([`src/utils/observability.ts`](../../src/utils/observability.ts), [`App.tsx`](../../App.tsx), boundary en [`index.tsx`](../../index.tsx)).  
**Entrada PostHog:** [`index.tsx`](../../index.tsx) · **App:** [`App.tsx`](../../App.tsx) · **Hooks:** `useSupplements.ts`, `useHealthData.ts`, `useStock.ts`, `useDailyLog.ts`, `useHealthKitDataScreen.ts` (sin eventos de fallo en el hook) · **Pantallas:** `MealPrep.tsx`, `Profile.tsx`, `DailyLogByDate.tsx`, `Stock.tsx`, `HealthKitData.tsx`

---

## Objetivo

- PostHog solo para **eventos de producto**: flujos, intención de uso, verificación en dev y (futuro) feature flags / experimentos.
- **No** duplicar errores globales en PostHog: excepciones, fallos de dominio y logs estructurados van a **Sentry** (`reportErrorToSentry` o captura nativa del SDK).
- Segmentar por perfil de app (`diana` | `estefania`) vía `identify` y por entorno vía propiedad registrada `app_environment` (`development` | `preview` | `production`).

Fuera de alcance en PostHog: autocapture de UI (toques/pantallas), session replay, captura automática de `console`/`uncaughtExceptions` (retirada a favor de Sentry).

---

## Configuración y entorno

| Variable        | Obligatoria | Descripción                                      |
|-----------------|-------------|--------------------------------------------------|
| `POSTHOG_API_KEY` | No        | Si falta o está vacía, el SDK va con `disabled: true` (cero envíos). |
| `POSTHOG_HOST`    | No        | Host del proyecto; por defecto `https://us.i.posthog.com`. |
| `EXPO_PUBLIC_APP_ENV` | No    | En release (`__DEV__` falso): `preview` \| `production` (típico vía [`eas.json`](../../eas.json)). En Metro/dev, `getAppEnvironment()` usa `development` por `__DEV__`. |

- Declaración TypeScript: [`src/types/env.d.ts`](../../src/types/env.d.ts) (`ProcessEnv`).
- **No** commitear API keys. Rotar clave si se expuso en chat o repo.

### Criterios de aceptación (config)

| ID   | Criterio |
|------|----------|
| PH-C1 | Con `POSTHOG_API_KEY` definida y no vacía, el cliente no está `disabled` y usa `POSTHOG_HOST` o el default US. |
| PH-C2 | Sin API key, la app arranca sin crash y PostHog no envía eventos. |
| PH-C3 | Ninguna clave PostHog aparece en código fuente versionado. |

---

## Árbol de proveedores

1. `PostHogProvider` (raíz).
2. `RootErrorBoundary` (React) envuelve `App`: errores de render → Sentry + fallback en español (sin `PostHogErrorBoundary` para no enviar excepciones a PostHog).
3. `autocapture={false}`.
4. `captureAppLifecycleEvents: false`.
5. **Sin** `errorTracking.autocapture` en PostHog (errores → Sentry).

### Error Boundary (React)

- Fallback en español: título “Algo salió mal” + mensaje del error.
- El boundary reporta a Sentry con `domain: react_render`.

| ID   | Criterio |
|------|----------|
| PH-E1 | Un throw en render bajo el boundary muestra el fallback y no deja pantalla en blanco sin manejo. |

---

## Identificación

- Tras seleccionar perfil: `posthog.identify(user, { app: 'comuna' })` con `user ∈ { diana, estefania }`.
- Al cambiar de perfil, se vuelve a llamar `identify` con el nuevo `user`.
- En arranque (si PostHog activo): `posthog.register({ app_environment })` alineado con [`getAppEnvironment()`](../../src/utils/observability.ts).

| ID   | Criterio |
|------|----------|
| PH-I1 | Eventos posteriores quedan asociados al `distinct_id` del perfil activo. |

---

## Eventos explícitos en PostHog (snake_case)

Solo eventos de **producto / flujo**. Los `capture` son no-op si PostHog está deshabilitado (`posthog?.capture`).

| Evento | Disparador | Propiedades mínimas |
|--------|------------|---------------------|
| `meal_prep_loaded` | Carga completa de la pestaña Comidas (éxito o sin plan en Notion) | `user`, `has_week_plan`, `has_today_meals`, `meals_count`; si hay plan: `top_level_block_count`, `expanded_block_count` |
| `selected_user_restored` | Hidratación en arranque: hay `selected_user` válido en AsyncStorage | `user` |
| `user_picker_shown` | Se muestra la pantalla de selector de perfil (sin pestañas) | `reason`: `no_stored_value` \| `manual_clear` |
| `user_picker_completed` | Elección de perfil en la pantalla de selector de `App` | `user`, `reason` (mismo valor que `user_picker_shown`), `persisted`: `true` si AsyncStorage guardó OK; `false` si hubo error de persistencia pero la app abrió pestañas igual |
| `user_switched_in_profile` | Cambio Diana/Estefanía en Perfil (solo si el perfil cambia) | `previous_user`, `user` |
| `stored_user_cleared` | Pulsar «Cambiar usuario» en Perfil (tras borrar clave) | `previous_user` |
| `daily_log_history_opened` | Abrir «Mis tomas por día» desde Perfil (montaje de `DailyLogByDate`) | `user` |
| `healthkit_sync_retried` | Pulsar «Reintentar sincronización con Salud» en Perfil (iOS) | `user` |
| `healthkit_data_screen_viewed` | Primer montaje de la pestaña Salud (`HealthKitData`) | `user` |

### Eventos retirados de PostHog (ahora solo Sentry)

| Antiguo evento PostHog | Destino Sentry |
|------------------------|----------------|
| `migration_failed` | `domain: drizzle_migrations` |
| `notion_supplements_sync_failed` | `domain: notion` |
| `notion_supplements_local_sync_failed` | `domain: sqlite` |
| `health_data_load_failed` | `domain: health_data` |
| `health_data_notion_sync_failed` | `domain: health_data` |
| `healthkit_last_menstruation_failed` | `domain: healthkit` |
| `stock_load_failed` | `domain: sqlite` |
| `daily_log_load_failed` | `domain: sqlite` |
| `notion_meal_prep_load_failed` | `domain: notion` |
| `user_persistence_failed` | `domain: async_storage` + `operation` |

### Verificación de integración (no productivos)

| Evento | Disparador |
|--------|------------|
| `posthog_integration_verify` | Cold start en **`__DEV__`** si PostHog está activo (`index.tsx`). |
| `posthog_integration_verify_manual` | ~~Botón en Perfil~~ retirado de la UI; el evento puede seguir documentado por si se vuelve a exponer en dev. |

### Reglas

- No incluir PII (emails, nombres reales) en propiedades.
- Nuevos eventos de producto: **actualizar este spec** antes o en el mismo PR que el código.
- **PostHog** queda reservado para experimentos / flags cuando un spec futuro lo defina.

| ID   | Criterio |
|------|----------|
| PH-V1 | Cada evento de la tabla de producto se emite según el disparador descrito (p. ej. `user_picker_shown` al mostrar el gate). |
| PH-V2 | Nombres de eventos solo `snake_case` y prefijados por dominio cuando aplique (`notion_`, `healthkit_`, etc.). |

**Nota:** `healthkit_sync_retried` puede dispararse varias veces por sesión (cada tap); no es un error, es acción explícita de QA/usuaria.

---

## Sentry (React Native)

### Runtime (app)

- **DSN:** `SENTRY_DSN` en `.env` / EAS (módulo `@env`). No versionar el valor.
- Si falta o está vacía: no se ejecuta `Sentry.init` y el export default de `App` es sin `Sentry.wrap`.
- **`environment`:** coincide con `getAppEnvironment()` (`development` | `preview` | `production`).
- **`release` / `dist`:** desde Expo config (`slug@version` y build nativo) vía [`getSentryRelease()` / `getSentryDist()`](../../src/utils/observability.ts).
- **Fallos de dominio:** `reportErrorToSentry(error, { domain, user?, ...extra })` — tags `domain`, `app_environment`; opcional `user` como `id` de scope.
- **Dominios adicionales:** `stock_restock` (fallo al marcar recompra Notion/backend), `stock_save` / `stock_new_bottle` (guardado desde pantalla Stock), `shared_stock` (GET compartido fallido o JSON inválido; sin DSN no se envía). Consola: solo errores HealthKit en `__DEV__` (`src/api/healthkit.ts`); sin `console` duplicado en migraciones (ya `MigrationFailureReporter`).

### Builds EAS / subida de source maps (Xcode archive)

Con `@sentry/react-native` y el plugin de Expo, el paso de bundle en **Release** invoca `sentry-cli` para subir source maps. El **DSN no autentica esa subida**: hace falta un token en el entorno del job de build.

| Variable | Dónde | Rol |
|----------|--------|-----|
| `SENTRY_AUTH_TOKEN` | **EAS Secret** (recomendado) o env del perfil en dashboard EAS | Autenticación de `sentry-cli` ante la API de Sentry al subir releases/source maps. **No** empaquetar en la app; solo CI. |
| `SENTRY_DSN` | EAS env / secret (además de `.env` local) | Runtime del SDK (eventos); independiente del token. |

**Crear el token (documentación actual de Sentry):** Sentry recomienda [Organization Tokens](https://docs.sentry.io/account/auth-tokens/) para CI: en la org → **Settings → Developer Settings → Organization Tokens**. Los permisos vienen fijados para tareas típicas de CI (incl. source maps). Alternativas: [Internal Integrations](https://docs.sentry.io/organization/integrations/integration-platform/) o [Personal Tokens](https://docs.sentry.io/account/auth-tokens/) si hiciera falta otro alcance (ver [cuándo usar cada tipo](https://docs.sentry.io/account/auth-tokens/#when-should-i-use-which)). El token solo se muestra completo una vez al crearlo.

**Registrar el token en EAS** (sustituir el valor; no commitear). La CLI actual usa **variables de entorno** del proyecto (sustituyen en la práctica a los “secrets” antiguos; ver [variables y entorno en EAS](https://docs.expo.dev/eas/environment-variables/)):

```bash
# Mismo token en preview y production (ajustar entornos si solo compilás uno)
eas env:create --name SENTRY_AUTH_TOKEN --value "<token_de_sentry>" \
  --environment preview --environment production \
  --visibility secret --non-interactive --scope project
```

Si aún usás la sintaxis antigua: `eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "<token_de_sentry>"` (puede mostrarse como deprecada según versión de CLI).

Tras definir la variable, un `eas build` iOS en Release no debe fallar con `Auth token is required for this request` en la fase de upload de maps.

**Válvulas de escape** (solo si se acepta perder subida fiable o maps en Sentry):

| Variable | Efecto |
|----------|--------|
| `SENTRY_ALLOW_FAILURE=true` | Si la subida falla, el build **no** falla por ello (mensaje lo indica el propio `sentry-cli`). |
| `SENTRY_DISABLE_AUTO_UPLOAD=true` | No intenta subir maps; el archive suele pasar, pero los stack traces JS en Sentry pueden quedar sin simbolizar hasta subir maps por otro medio. |

Se pueden fijar en [`eas.json`](../../eas.json) bajo `build.<perfil>.env` si el equipo elige explícitamente ese trade-off.

**Verificación tras un build con token:**

1. Logs del job: sin `error: Auth token is required for this request` y sin fallo en `Processing react-native sourcemaps for Sentry upload`.
2. En Sentry, release alineada con `getSentryRelease()` / `getSentryDist()`: artifacts (source maps) asociados a la release.

| ID   | Criterio |
|------|----------|
| SE-C1 | Con `SENTRY_DSN` no vacío, el SDK se inicializa con `environment`/`release` acordes y el export default usa `Sentry.wrap(App)`. |
| SE-C2 | Sin DSN, la app arranca sin inicializar Sentry. |
| SE-C3 | Ningún DSN aparece hardcodeado en código fuente versionado. |
| SE-C4 | Errores de render del boundary llegan a Sentry con `domain: react_render`. |
| SE-EAS1 | Build iOS Release en EAS con plugin Sentry: con `SENTRY_AUTH_TOKEN` como secret del proyecto, la subida de source maps por `sentry-cli` completa sin `Auth token is required`. |
| SE-EAS2 | Sin token, el equipo puede documentar y usar `SENTRY_ALLOW_FAILURE` o `SENTRY_DISABLE_AUTO_UPLOAD` en el perfil EAS si acepta el trade-off (maps no garantizados). |

---

## Cambios futuros

Cualquier modificación a proveedores, eventos o variables de entorno PostHog / Sentry debe:

1. Actualizar este documento.
2. Mantener alineación con [`.cursor/rules/spec-driven.mdc`](../../.cursor/rules/spec-driven.mdc).

---

## Referencias

- PostHog React Native SDK (`posthog-react-native`).
- Sentry React Native (`@sentry/react-native`).
- Sentry: [Auth tokens](https://docs.sentry.io/account/auth-tokens/) · [Sentry CLI / configuración](https://docs.sentry.io/cli/configuration/).
- EAS: [Variables y secrets](https://docs.expo.dev/eas/environment-variables/).
- Documentación interna: [`CLAUDE.md`](../../CLAUDE.md) (variables de entorno).
