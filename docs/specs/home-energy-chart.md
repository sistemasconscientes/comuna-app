# Home — barra de fase del ciclo

> El nombre del archivo conserva la ruta histórica (`home-energy-chart.md`); el contenido describe la **barra de fase** que reemplazó la gráfica de energía.

## Alcance

En la pantalla Inicio, entre la cabecera (pastilla de fase) y el bloque «Para hoy» (lista + barra fina de progreso), se muestra una tarjeta destacada con:

- Cuatro etiquetas cortas de fase (`Mens.`, `Fol.`, `Ovul.`, `Lútea`) en fila; la fase actual resalta con color de `PHASE_CONFIG`.
- Una pista horizontal con relleno de color y un emoji marcador según la fase.
- Un pie con **solo** el mensaje textual de la fase (sin número de día del ciclo en esta versión).

## Fuente de datos

- `cyclePhase` y `cycleDay` provienen de [`useHealthData`](../../src/hooks/useHealthData.ts): en iOS, si HealthKit aporta `lastPeriodStart`, la fase y el día se calculan con [`getCurrentCycleInfoWithHealthKitRefinements`](../../src/utils/phaseCalculator.ts); si no hay HK pero hay último período en SQLite, mismo cálculo; sin ancla de período, solo fase desde Notion y `cycleDay === null`.
- En la UI, el tipo [`Phase`](../../src/types/index.ts) usa `ovulatoria`; se mapea `ovulacion` → `ovulatoria` para colores, mensajes y etiquetas de la barra.

## Criterios de aceptación

| # | Criterio |
|---|----------|
| 1 | `PHASE_CONFIG` define por fase: `emoji`, `message`, `fillPercent` (respaldo), `color`, `fillColor`. |
| 2 | Si `cycleDay !== null`, el ancho del relleno de la pista y la posición horizontal del emoji usan `min(100, (cycleDay / DEFAULT_CYCLE_LENGTH_DAYS) * 100)` con `DEFAULT_CYCLE_LENGTH_DAYS` desde `phaseCalculator.ts`. |
| 3 | Si `cycleDay === null` (solo Notion sin día), el ancho y el marcador usan `fillPercent` de la fase actual. |
| 4 | El pie de la tarjeta muestra únicamente `message` con `color` de la fase; no se muestra “Día X de 28” ni texto numérico equivalente en esta versión. |
| 5 | La pista es claramente legible (altura ~11, bordes redondeados), fondo `#f0ece6`, `overflow: 'visible'` para el emoji del marcador (~24 px). El mensaje de fase usa tipografía de cuerpo (~15 px), no microtexto. |

## Implementación

- [`src/screens/Home.tsx`](../../src/screens/Home.tsx) (tarjeta inline, sin componente dedicado salvo evolución futura).

## Dependencias

- Ninguna de gráficos: no `victory-native` ni Skia para esta tarjeta.
