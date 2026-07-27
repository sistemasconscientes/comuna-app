# HealthKit: observación ampliada + duración de ciclo estimada

## Observación (solo lectura)

La pestaña Salud muestra métricas informativas **sin efecto en fase ni suplementos** (base para futuras funciones):

- Sueño últimas 24 h — tramos dormida (`sleepAnalysis` valores 1/3/4/5) fusionando solapes entre fuentes (`mergeIntervalsTotalMs`, iPhone+Watch no duplican).
- FC en reposo, HRV (SDNN), temperatura de muñeca (Watch S8+), frecuencia respiratoria — última muestra en unidad preferida.
- Pasos de hoy — suma desde medianoche local.

Piezas: `buildObservationRows` en `src/api/healthkit.ts` (cada métrica falla aislada; sin muestras ⇒ «Sin datos»), helpers puros en `src/utils/healthObservation.ts`. Tipos agregados a `buildReadTypes` (permiso de lectura).

## Duración de ciclo estimada

Reemplaza el modelo fijo de 28 días cuando Salud tiene historial suficiente:

- `derivePeriodStartsFromFlowSampleDates` reconstruye inicios de episodios (hueco ≤7 días entre días con flujo).
- `estimateCycleLengthFromPeriodStarts`: **mediana** de deltas entre inicios consecutivos, descartando fuera de [21, 45] días; requiere ≥2 deltas válidos (≈3 inicios), usa máx. 6.
- `HealthKitCycleSignals.estimatedCycleLengthDays` → `useHealthData` lo pasa como `cycleLength` al calcular fase/día; sin estimación ⇒ fallback `DEFAULT_CYCLE_LENGTH_DAYS` (28).
- Fila «Duración de ciclo estimada» en Salud muestra el valor y cuántos ciclos lo respaldan.

## QA manual

1. Salud con ≥3 inicios de período → la fila muestra la mediana y el día/fase del Home cambia acorde (ciclo de 30: día 29 sigue siendo lútea, no «día 1»).
2. Sin historial → «Sin ciclos suficientes» y el modelo de 28 sigue operando.
3. Salud: cada métrica de observación muestra valor o «Sin datos» sin romper el resto de la pestaña.
