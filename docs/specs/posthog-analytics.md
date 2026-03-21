# Spec: PostHog — analítica y errores críticos

**Estado:** implementado  
**Entrada:** [`index.tsx`](../../index.tsx) · **App:** [`App.tsx`](../../App.tsx) (persistencia usuario + picker, pestañas) · **Hooks:** `src/hooks/useSupplements.ts`, `useHealthData.ts`, `useStock.ts`, `useDailyLog.ts` · **Pantallas:** `src/screens/Home.tsx`, `MealPrep.tsx`, `Profile.tsx`, `DailyLogByDate.tsx`, `Stock.tsx`

---

## Objetivo

- Tener PostHog listo para producción sin hardcodear credenciales.
- Captura **automática** de errores globales (JS no capturados, promesas rechazadas, `console.error` / `console.warn`).
- Captura **explícita** en fallos críticos de dominio (Notion, HealthKit, SQLite, migraciones).
- Segmentar por perfil de app (`diana` | `estefania`) vía `identify`.

Fuera de alcance: autocapture de UI (toques/pantallas), session replay, feature flags (salvo que un spec futuro lo defina).

---

## Configuración y entorno

| Variable        | Obligatoria | Descripción                                      |
|-----------------|-------------|--------------------------------------------------|
| `POSTHOG_API_KEY` | No        | Si falta o está vacía, el SDK va con `disabled: true` (cero envíos). |
| `POSTHOG_HOST`    | No        | Host del proyecto; por defecto `https://us.i.posthog.com`. |

- Declaración TypeScript: [`src/types/env.d.ts`](../../src/types/env.d.ts).
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
2. `PostHogErrorBoundary` envuelve `App`.
3. `autocapture={false}` (sin autocapture de navegación/toques).
4. `captureAppLifecycleEvents: false` (solo errores + eventos explícitos; cambiar solo vía este spec).
5. Con API key activa: `errorTracking.autocapture` con `uncaughtExceptions`, `unhandledRejections`, `console: ['error','warn']`.

### Error Boundary (React)

- Fallback en español: título “Algo salió mal” + mensaje del error.
- Errores de render hijos se reportan al contexto PostHog del boundary.

| ID   | Criterio |
|------|----------|
| PH-E1 | Un throw en render bajo el boundary muestra el fallback y no deja pantalla en blanco sin manejo. |

---

## Identificación

- Tras seleccionar perfil: `posthog.identify(user, { app: 'comuna' })` con `user ∈ { diana, estefania }`.
- Al cambiar de perfil, se vuelve a llamar `identify` con el nuevo `user`.

| ID   | Criterio |
|------|----------|
| PH-I1 | Eventos posteriores quedan asociados al `distinct_id` del perfil activo. |

---

## Eventos explícitos (snake_case)

Todos los `capture` son no-op si PostHog está deshabilitado (`posthog?.capture`).

| Evento | Disparador | Propiedades mínimas |
|--------|------------|---------------------|
| `migration_failed` | Fallo de `useMigrations` | `message`, `error_name` |
| `notion_supplements_sync_failed` | Fallo al obtener suplementos desde Notion | `domain: 'notion'`, `message`, `user` |
| `notion_supplements_local_sync_failed` | Fallo al persistir suplementos en SQLite tras fetch OK | `domain: 'sqlite'`, `message`, `user` |
| `health_data_load_failed` | Fallo en la carga general (DB/Notion) del hook de salud | `domain: 'health_data'`, `message`, `user` |
| `health_data_notion_sync_failed` | Fallo al leer/escribir Notion tras sync exitoso de HealthKit (comparación o `updatePhase`) | `domain: 'health_data'`, `message`, `user` |
| `healthkit_last_menstruation_failed` | Fallo al leer última menstruación en HealthKit (iOS) | `domain: 'healthkit'`, `message`, `user` |
| `healthkit_sync_retried` | Pulsar «Reintentar sincronización con Salud» en Perfil (iOS) | `user` |
| `stock_load_failed` | Fallo al leer tabla stock | `domain: 'sqlite'`, `message` |
| `daily_log_load_failed` | Fallo al leer daily logs por fecha | `domain: 'sqlite'`, `message`, `date` |
| `meal_prep_loaded` | Carga completa de la pestaña Comidas (éxito o sin plan en Notion) | `user`, `has_week_plan`, `has_today_meals`, `meals_count`; si hay plan: `top_level_block_count`, `expanded_block_count` |
| `notion_meal_prep_load_failed` | Excepción al obtener/expandir/parsear meal prep | `domain: 'notion'`, `message`, `user` |
| `selected_user_restored` | Hidratación en arranque: hay `selected_user` válido en AsyncStorage | `user` |
| `user_picker_shown` | Se muestra la pantalla de selector de perfil (sin pestañas) | `reason`: `no_stored_value` \| `manual_clear` |
| `user_picker_completed` | Elección de perfil en la pantalla de selector de `App` | `user`, `reason` (mismo valor que `user_picker_shown`) |
| `user_switched_in_profile` | Cambio Diana/Estefanía en Perfil (solo si el perfil cambia) | `previous_user`, `user` |
| `stored_user_cleared` | Pulsar «Cambiar usuario» en Perfil (tras borrar clave) | `previous_user` |
| `user_persistence_failed` | Error al leer/escribir/borrar `selected_user` en AsyncStorage | `operation`: `read` \| `write` \| `remove`, `message` |
| `daily_log_history_opened` | Abrir «Mis tomas por día» desde Perfil (montaje de `DailyLogByDate`) | `user` |

### Verificación de integración (no productivos)

| Evento | Disparador |
|--------|------------|
| `posthog_integration_verify` | Cold start en **`__DEV__`** si PostHog está activo (`index.tsx`). |
| `posthog_integration_verify_manual` | ~~Botón en Perfil~~ retirado de la UI; el evento puede seguir documentado por si se vuelve a exponer en dev. |

### Reglas

- No incluir PII (emails, nombres reales) en propiedades.
- Nuevos eventos críticos: **actualizar este spec** antes o en el mismo PR que el código.

| ID   | Criterio |
|------|----------|
| PH-V1 | Cada evento de la tabla anterior se emite como máximo una vez por fallo lógico descrito (p. ej. `migration_failed` una vez por sesión de error de migración). |
| PH-V2 | Nombres de eventos solo `snake_case` y prefijados por dominio cuando aplique (`notion_`, `healthkit_`, etc.). |

**Nota:** `healthkit_sync_retried` puede dispararse varias veces por sesión (cada tap); no es un error, es acción explícita de QA/usuaria.

---

## Cambios futuros

Cualquier modificación a proveedores, eventos o variables de entorno PostHog debe:

1. Actualizar este documento.
2. Mantener alineación con [`.cursor/rules/spec-driven.mdc`](../../.cursor/rules/spec-driven.mdc).

---

## Referencias

- PostHog React Native SDK (`posthog-react-native`).
- Documentación interna: [`CLAUDE.md`](../../CLAUDE.md) (variables de entorno).
