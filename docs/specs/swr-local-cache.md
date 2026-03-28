# Caché local SWR (stale-while-revalidate)

**Estado:** implementado  
**Hook:** [`src/hooks/useCache.ts`](../../src/hooks/useCache.ts)  
**Pantallas:** [`src/screens/Stock.tsx`](../../src/screens/Stock.tsx), [`src/screens/MealPrep.tsx`](../../src/screens/MealPrep.tsx)

---

## Objetivo

Mostrar datos persistidos en AsyncStorage al abrir la pantalla (sin spinner si hay caché válida), revalidar en segundo plano cuando el TTL expiró, y permitir pull-to-refresh manual. No sustituye la fuente de verdad remota (Notion / backend); solo reduce latencia percibida.

---

## Formato de almacenamiento

- Clave: prefijo interno + `key` lógica (p. ej. `stock_diana`, `meal_prep`).
- Valor: JSON `{ value: T, fetchedAt: number }` donde `fetchedAt` es `Date.now()` en ms tras un fetch exitoso.
- `T` debe ser serializable con `JSON.stringify`. Los objetos con `Date` (p. ej. `SharedStock` en el bundle de Stock) se normalizan al consumir con [`reviveSharedStockMapFromCache`](../../src/api/sharedStock.ts).

---

## Comportamiento (`useCache`)

| Situación | UI `loading` | Acción |
|-----------|----------------|--------|
| Sin entrada o JSON inválido | `true` hasta primer fetch OK | Fetch inicial; persiste al éxito |
| Entrada válida | `false` de inmediato tras leer storage | Muestra `value` |
| TTL expirado (`now - fetchedAt > ttlMs`) | Sigue `false` si ya hay datos | Revalidación en background; al éxito actualiza estado y storage |
| TTL no expirado | `false` | Sin refetch al montar |
| Fetch falla sin datos en memoria | `false` | `error` rellenado; `data` null |
| Fetch falla con datos (stale o refresh) | `false` | Se mantiene `data`; `error` actualizado |

- **`refresh()`:** fuerza fetch, `refreshing === true` mientras dura (para `RefreshControl`); devuelve `Promise<void>` que resuelve al terminar (útil tras mutaciones, p. ej. stock compartido).
- **`fetcher`:** el hook mantiene la última referencia en `useRef` para no re-ejecutar el efecto de hidratación por identidad del closure.

---

## Integraciones y TTL

| Pantalla | Key | TTL | Lista / scroll |
|----------|-----|-----|----------------|
| Stock | `stock_${user}` | 5 min | `FlatList` + `RefreshControl` |
| Comidas | `meal_prep` | 30 min | `ScrollView` + `RefreshControl` |

Stock: el bundle cacheado incluye suplementos Notion + sync SQLite (`idByNotionId`) + `sharedByNotionId` (backend). La tabla `stock` local sigue cargándose con `useStock()` (sin caché en este hook).

MealPrep: el fetcher equivale al pipeline previo (`getMealPrep` → expandir tablas → `getTodayMeals(expanded, user)`). Los eventos PostHog existentes se disparan dentro del fetcher (sin nuevos eventos por la capa de caché).

---

## Criterios de aceptación

| ID | Criterio |
|----|----------|
| SWR-C1 | Con caché válida para la key, la pantalla no muestra el spinner de carga inicial (solo contenido o estado vacío coherente). |
| SWR-C2 | Si el TTL expiró y hay datos mostrados, la revalidación no vuelve a poner `loading` en `true`. |
| SWR-C3 | Pull-to-refresh llama a `refresh` y muestra el indicador nativo mientras `refreshing` es `true`. |
| SWR-C4 | Tras éxito de fetch, se actualiza AsyncStorage con el nuevo `value` y `fetchedAt`. |

---

## Nota (Comidas y cambio de día)

`getTodayMeals` depende del día local en el momento del fetch. Con TTL de 30 min, si la app permanece abierta más allá de medianoche sin revalidar, el texto puede quedar desalineado con el día actual hasta el próximo fetch o refresh. Aceptado; mitigación futura: invalidar por fecha calendario.
