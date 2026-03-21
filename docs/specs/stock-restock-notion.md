# Spec: Recompra en Notion (bajo stock)

**Pantalla:** [`src/screens/Stock.tsx`](../../src/screens/Stock.tsx)  
**Hook:** [`src/hooks/useStock.ts`](../../src/hooks/useStock.ts)  
**API:** [`src/api/notion.ts`](../../src/api/notion.ts) (`markForRestock`)

---

## Alcance

- Tras calcular `daysRemaining` por suplemento (sin cambiar la fórmula existente), si `daysRemaining < 7` y la fila de `stock` tiene `restock_flagged = false`, llamar a `markForRestock(notion_id)` y persistir `restock_flagged = true` en SQLite para no repetir llamadas a Notion.
- Si `restock_flagged = true`, no volver a llamar a Notion por ese suplemento (hasta reset vía “Abrí frasco nuevo”).
- Lista: indicación visual suave (fila y badge) cuando `daysRemaining < 7`.

Fuera de alcance: botón para desmarcar recompra (v2).

---

## Criterios de aceptación

| ID | Criterio |
|----|----------|
| SR1 | Columna `restock_flagged` en tabla `stock` (boolean, default false). |
| SR2 | Con `daysRemaining < 7` y `restock_flagged` false, se llama a `markForRestock` y luego se guarda `restock_flagged` true. |
| SR3 | Con `restock_flagged` true, no se llama de nuevo a `markForRestock` en cargas posteriores. |
| SR4 | “Abrí frasco nuevo” pone `restock_flagged` false para permitir un nuevo aviso si vuelve a bajar el stock. |
| SR5 | Si `markForRestock` falla, no se marca `restock_flagged` (reintento en la próxima carga). |
| SR6 | Filas con menos de 7 días se distinguen visualmente (fondo o texto rojo suave). |
