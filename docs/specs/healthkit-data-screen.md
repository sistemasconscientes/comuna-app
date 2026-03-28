# Spec: Pestaña Salud — datos HealthKit visibles

**Implementación:** [`src/api/healthkit.ts`](../../src/api/healthkit.ts) (`getHealthKitDataScreenSnapshot`) · Hook [`src/hooks/useHealthKitDataScreen.ts`](../../src/hooks/useHealthKitDataScreen.ts) · Pantalla [`src/screens/HealthKitData.tsx`](../../src/screens/HealthKitData.tsx) · Barra de pestañas [`App.tsx`](../../App.tsx)

**Relacionado:** [`healthkit-cycle-sync.md`](./healthkit-cycle-sync.md) (lógica de fase y señales)

---

## Objetivo

Cuarta pestaña inferior **Salud** que lista, en lenguaje claro, qué datos de Apple Salud la app puede leer y el **valor** o estado actual, distinguiendo:

1. **Sin datos en Salud** — no hay muestras o no aplica la ventana (p. ej. sin inicio de período para ovulación/BBT); **no** es error ni se reporta como tal.
2. **Permiso** — autorización no determinada o denegada para un tipo concreto.
3. **Error de extracción** — fallo al consultar permiso o muestras que **no** es el patrón benigno de permisos (ver `isBenignHealthKitReadError` en `healthkit.ts`); se envía a **Sentry** con `domain: healthkit_data_screen` y extras (`operation`, `row_id`, `healthkit_identifier` cuando aplica).

---

## Alcance de filas (iOS)

- Plataforma, módulo nativo, repositorio de Salud.
- Lectura consolidada del bloque de ciclo (`fetchHealthKitCycleSignalsForHk`): éxito vs error no benigno (Sentry).
- Permisos y valores: flujo menstrual, inicio de último período (derivado), test de ovulación, moco cervical, temperatura basal (ancla), irregularidad (categorías), contexto embarazo/lactancia/anticonceptivo.

Fuera de alcance: escritura en Salud, edición de datos, gráficos.

---

## Plataformas no iOS

Una fila indica que HealthKit no está disponible (sin Sentry salvo fallo inesperado del fetcher).

---

## Criterios de aceptación

| ID | Criterio |
|----|----------|
| HK-DS-1 | La barra inferior incluye la pestaña **Salud** y monta `HealthKitData`. |
| HK-DS-2 | Cada fila muestra etiqueta + texto principal; opcionalmente `hint` para aclarar «sin datos» vs permisos. |
| HK-DS-3 | Texto explícito **«Sin datos en Salud»** (o equivalente) cuando no hay muestras pero la lectura técnica fue válida. |
| HK-DS-4 | Errores no benignos en `authorizationStatusFor`, `queryCategorySamples` o `queryQuantitySamples` (BBT) disparan `reportErrorToSentry` con `domain: healthkit_data_screen` y la fila correspondiente muestra mensaje de error (no se confunde con «sin datos»). |
| HK-DS-5 | Pull-to-refresh recarga el snapshot (TTL corto vía `useCache`). |
| HK-DS-6 | PostHog: al primer montaje de la pantalla se emite `healthkit_data_screen_viewed` con `user`. |

---

## PostHog

Documentado en [`posthog-analytics.md`](./posthog-analytics.md).
