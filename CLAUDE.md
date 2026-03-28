# Comuna App

App móvil iOS de seguimiento de suplementos basada en fases del ciclo menstrual.

## Stack
- React Native + Expo (SDK 55)
- TypeScript
- SQLite local con Drizzle ORM
- Notion como base de datos de suplementos y fases

## Usuarios
- Diana (`diana`) y Estefanía (`estefania`) — seleccionables desde Profile
- El contexto de usuario vive en `src/context/UserContext.tsx`
- Tipo: `User = 'diana' | 'estefania'`
- Los datos de Notion están separados por usuario

## Specs (spec-driven)
- Convención: `docs/specs/*.md` — ver `docs/specs/README.md` y `.cursor/rules/spec-driven.mdc`.

## Arquitectura clave
- `src/api/notion.ts` — Fetch desde Notion API. La app sincroniza al iniciar. Funciones principales: `getSupplements(user, currentPhase, applyTemporadaFilter?)`, `getCurrentPhase(user)`, `updatePhase(user, phase, nextCycle)` (tabla inline de fases con texto + emoji), `markForRestock(notion_id)`, `getMealPrep()` (hijos directos de la página del plan), `listNotionBlockChildrenPage` (hijos de un bloque; Comidas expande tablas con esto)
- `src/utils/mealPrepParser.ts` — `expandMealPrepNotionBlocks`, `getTodayMeals` para la pestaña Comidas
- `src/api/healthkit.ts` — iOS: lectura de última menstruación para derivar fase (ver spec HealthKit)
- `src/db/schema.ts` — Schema SQLite local: `supplements`, `dailyLogs`, `stock` (incl. `restock_flagged` para deduplicar recompra en Notion), `phases`, `cycle_states`
- `src/hooks/` — Lógica de negocio. Un hook por dominio. `useHealthData`: con datos de HealthKit, compara fase/fecha con Notion y llama a `updatePhase` solo si difieren. `useStock`: persiste `restock_flagged` al marcar recompra.
- `src/screens/` — Pantallas con mínima lógica propia.
- `src/types/index.ts` — Todos los types e interfaces del proyecto

## Fases del ciclo
Cuatro fases: `menstrual`, `folicular`, `ovulatoria` / `ovulacion`, `lutea`
- Hay dos type aliases: `Phase` (Notion-facing) y `CyclePhase` (local DB) — difieren en la fase ovulatoria
- Los suplementos pueden ser phase-specific o `'all'`

## Comandos frecuentes
- `npm run db:generate` — generar migraciones tras cambiar schema.ts
- `npm run db:migrate` — correr migraciones
- `expo run:ios` — correr en simulador iOS
- `npm test` — correr tests con Jest
- `npm run db:studio` — Drizzle Studio para inspeccionar la DB
- `npm run version:sync` — sincroniza `package.json` (`version`, `nativeBuild`) → `app.json` (semver, `ios.buildNumber`, `android.versionCode`); ver `docs/specs/release-versioning.md`
- `npm run version:check` — valida alineación sin escribir; `npm test` lo ejecuta antes de Jest

## Convenciones
- Hooks en `src/hooks/`, nombrados `use<Domain>.ts`
- Types centralizados en `src/types/index.ts`
- No meter lógica de negocio en screens
- Notion es source of truth; SQLite es caché local

## Variables de entorno
Ver `.env`. Requiere:
- `NOTION_API_KEY`
- `NOTION_SUPPLEMENTS_DB_ID`
- `NOTION_PHASES_PAGE_ID`
- `NOTION_MEAL_PREP_HUB_PAGE_ID` — (opcional) página con **Comidas Activas**; sin ella `getMealPrep` devuelve `null`

Opcional (PostHog: errores automáticos + eventos críticos en hooks):
- `POSTHOG_API_KEY` — si no está definida, PostHog no envía datos (`disabled`)
- `POSTHOG_HOST` — ej. `https://us.i.posthog.com`

Opcional (Sentry):
- `SENTRY_DSN` — si falta o está vacía, no se inicializa Sentry (`App.tsx`)

## Qué NO hacer
- No hardcodear credenciales de Notion fuera de `.env`
- No meter lógica de negocio directamente en screens
- No crear archivos nuevos si se puede extender uno existente
- No modificar las migraciones generadas manualmente — usar `db:generate`
