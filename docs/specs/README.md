# Especificaciones (specs)

Documentos de comportamiento esperado. Los agentes y el equipo deben alinear implementación con estos archivos (ver `.cursor/rules/spec-driven.mdc`).

| Spec                                                                   | Descripción                                                                                                                       |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [posthog-analytics.md](./posthog-analytics.md)                         | PostHog: eventos de producto, env, identify; Sentry para errores (`observability.ts`)                                             |
| [healthkit-cycle-sync.md](./healthkit-cycle-sync.md)                   | Ciclo menstrual: HealthKit, SQLite, Notion, QA iOS                                                                                |
| [healthkit-data-screen.md](./healthkit-data-screen.md)                 | Pestaña Salud: snapshot legible de lecturas HealthKit, Sentry en errores de extracción                                            |
| [stock-edit-modal-ios-keyboard.md](./stock-edit-modal-ios-keyboard.md) | Modal Stock + teclado en iOS                                                                                                      |
| [stock-restock-notion.md](./stock-restock-notion.md)                   | Bajo stock: `markForRestock`, `restock_flagged`, UI                                                                               |
| [notion-supplements-temporada.md](./notion-supplements-temporada.md)   | `getSupplements`: filtro cliente por Temporada (año, Q1–Q4, fases)                                                                |
| [notion-meal-prep.md](./notion-meal-prep.md)                           | `getMealPrep`: plan activo, hijos directos de la página (`listBlockChildrenAll`)                                                  |
| [tea-of-the-day.md](./tea-of-the-day.md)                               | Té del día en Inicio: `getTeasForPhase`, `useTeas`, `TeaCard`, filtro cliente por fase + "tengo en casa"                          |
| [meal-prep-screen.md](./meal-prep-screen.md)                           | Pantalla Comidas, `mealPrepParser`, tab en `App`                                                                                  |
| [swr-local-cache.md](./swr-local-cache.md)                             | Caché AsyncStorage SWR: `useCache`, Stock y Comidas, TTL, pull-to-refresh                                                         |
| [user-selected-persistence.md](./user-selected-persistence.md)         | Usuario activo persistido en AsyncStorage, picker inicial, «Cambiar usuario»                                                      |
| [app-tab-bar.md](./app-tab-bar.md)                                     | Pestañas inferiores (`App.tsx`), retiro de Checklist vs Inicio                                                                    |
| [daily-log-by-date.md](./daily-log-by-date.md)                         | Registro de tomas por fecha, acceso desde Perfil                                                                                  |
| [daily-log-local-calendar.md](./daily-log-local-calendar.md)           | Día civil local (no UTC), refetch Notion al cambiar día, safe area Inicio/listas                                                  |
| [home-energy-chart.md](./home-energy-chart.md)                         | Inicio: barra de fase del ciclo (`Home.tsx`, `useHealthData`, `phaseCalculator`)                                                  |
| [home-screen-ui.md](./home-screen-ui.md)                               | Inicio: layout cabecera, paleta terracota/crema, lista tipo checklist                                                             |
| [npm-deprecation-warnings.md](./npm-deprecation-warnings.md)           | `npm warn deprecated`: diagnóstico, overrides seguros, avisos restantes                                                           |
| [release-versioning.md](./release-versioning.md)                       | Semver, `nativeBuild` → iOS `buildNumber` (+ `android.versionCode` solo por sync Expo), EAS, `version:sync`, smoke TestFlight iOS |
| [splash-screen.md](./splash-screen.md)                                 | Splash nativo (`app.json`), tema oscuro (`#141210`), `StatusBar` claro sobre UI oscura                                            |
| [backend-stock-api.md](./backend-stock-api.md)                         | Backend Express + Mongoose: `GET`/`PUT /stock/:notionId`, MongoDB, variables `MONGODB_URI` / `PORT` / `appName`                   |

Añadir aquí una fila al crear un spec nuevo.

**Cierre de feature con release:** si el PR sube versión de app, seguir [`release-versioning.md`](./release-versioning.md) (`version` + `nativeBuild` en `package.json`, `npm run version:sync` → `app.json`).
