# Home — gráfica de nivel de energía

## Alcance

En la pantalla Inicio, entre la tarjeta de fase actual y la lista de suplementos del día, se muestra una tarjeta con la curva fija de energía (0–10) a lo largo de 28 días y el día actual del ciclo (misma fuente que `useHealthData` / `phaseCalculator`).

## Criterios de aceptación

| # | Criterio |
|---|----------|
| 1 | La curva usa los puntos fijos `ENERGY_CURVE` (eje x 0–27, valor 0–10), línea suave `catmullRom`, color `#C97B6E`, sin puntos visibles. |
| 2 | El área bajo la curva usa el mismo color con opacidad 0.1. |
| 3 | Una línea vertical punteada (intervalos 4/4) en gris marca el día actual; la posición x corresponde al día del ciclo 1–28 mapeado a 0–27 (`día − 1`, acotado). |
| 4 | Cabecera: “ENERGY LEVEL” (uppercase, gris pequeño) y “Day X of 28” alineado a la derecha; debajo, el nivel textual según fase: menstrual → Bajo, folicular → Moderado, ovulatoria → Alto, lútea → Moderado. |
| 5 | Etiquetas bajo el gráfico: MENST. (x=1), FOLICULAR (x=7), OVUL. (x=14), LÚTEA (x=21), pequeñas, gris, uppercase. |
| 6 | `currentPhase` y día del ciclo provienen de `useHealthData` y del mismo cálculo de día que `getCycleDayFromDate` en `phaseCalculator.ts` (días civiles **locales** del dispositivo; expuesto como `cycleDay`); sin duplicar lógica en la screen más allá de mapear `ovulacion` → `ovulatoria` para el texto de la gráfica. |

## Dependencias

- `victory-native` (CartesianChart) con peers: `@shopify/react-native-skia`, `react-native-reanimated`, `react-native-gesture-handler`.
- Babel: plugin de Reanimated al final de la cadena.
