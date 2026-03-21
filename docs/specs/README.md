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

Añadir aquí una fila al crear un spec nuevo.
