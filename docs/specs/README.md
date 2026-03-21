# Especificaciones (specs)

Documentos de comportamiento esperado. Los agentes y el equipo deben alinear implementación con estos archivos (ver `.cursor/rules/spec-driven.mdc`).

| Spec | Descripción |
|------|-------------|
| [posthog-analytics.md](./posthog-analytics.md) | PostHog: env, errores automáticos, eventos críticos, identify |
| [healthkit-cycle-sync.md](./healthkit-cycle-sync.md) | Ciclo menstrual: HealthKit, SQLite, Notion, QA iOS |
| [stock-edit-modal-ios-keyboard.md](./stock-edit-modal-ios-keyboard.md) | Modal Stock + teclado en iOS |
| [stock-restock-notion.md](./stock-restock-notion.md) | Bajo stock: `markForRestock`, `restock_flagged`, UI |
| [notion-supplements-temporada.md](./notion-supplements-temporada.md) | `getSupplements`: filtro cliente por Temporada (año, Q1–Q4, fases) |
| [notion-meal-prep.md](./notion-meal-prep.md) | `getMealPrep`: plan activo, hijos directos de la página (`listBlockChildrenAll`) |
| [meal-prep-screen.md](./meal-prep-screen.md) | Pantalla Comidas, `mealPrepParser`, tab en `App` |
| [user-selected-persistence.md](./user-selected-persistence.md) | Usuario activo persistido en AsyncStorage, picker inicial, «Cambiar usuario» |
| [app-tab-bar.md](./app-tab-bar.md) | Pestañas inferiores (`App.tsx`), retiro de Checklist vs Inicio |
| [daily-log-by-date.md](./daily-log-by-date.md) | Registro de tomas por fecha, acceso desde Perfil |
| [home-energy-chart.md](./home-energy-chart.md) | Inicio: tarjeta gráfica de nivel de energía (`EnergyChart`, `victory-native`) |
| [home-screen-ui.md](./home-screen-ui.md) | Inicio: layout cabecera, paleta terracota/crema, lista tipo checklist |
| [npm-deprecation-warnings.md](./npm-deprecation-warnings.md) | `npm warn deprecated`: diagnóstico, overrides seguros, avisos restantes |

Añadir aquí una fila al crear un spec nuevo.
