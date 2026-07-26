/**
 * Helpers puros para las lecturas de observación de la pestaña Salud
 * (sueño, métricas de reposo). Sin I/O: `src/api/healthkit.ts` consulta.
 */

export interface MsInterval {
  startMs: number;
  endMs: number;
}

/**
 * Suma total de intervalos fusionando solapes (varias fuentes —iPhone y
 * Watch— reportan el mismo sueño; sumar sin fusionar duplicaría horas).
 */
export function mergeIntervalsTotalMs(intervals: MsInterval[]): number {
  const valid = intervals
    .filter((i) => Number.isFinite(i.startMs) && Number.isFinite(i.endMs) && i.endMs > i.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  let total = 0;
  let curStart: number | null = null;
  let curEnd = 0;
  for (const i of valid) {
    if (curStart === null || i.startMs > curEnd) {
      if (curStart !== null) total += curEnd - curStart;
      curStart = i.startMs;
      curEnd = i.endMs;
    } else if (i.endMs > curEnd) {
      curEnd = i.endMs;
    }
  }
  if (curStart !== null) total += curEnd - curStart;
  return total;
}

/** "7 h 25 min" (o "45 min" si es menos de una hora). */
export function formatDurationHM(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/** Redondeo por tipo de unidad para mostrar métricas de Salud. */
export function formatQuantity(value: number, unit: string): string {
  const u = unit.trim();
  const decimals = /degc|degf|°/i.test(u)
    ? 2
    : /ms\b/i.test(u)
      ? 0
      : /count\/min|bpm/i.test(u)
        ? 0
        : 0;
  const rounded = value.toFixed(decimals);
  const unitLabel = u
    .replace(/^count\/min$/i, 'rpm')
    .replace(/^count$/i, '')
    .replace(/^degc$/i, '°C')
    .replace(/^degf$/i, '°F');
  return unitLabel ? `${rounded} ${unitLabel}`.trim() : rounded;
}
