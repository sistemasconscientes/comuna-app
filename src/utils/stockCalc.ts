/**
 * Cálculo de pastillas/días restantes de un frasco abierto. Puro y testeable
 * (se inyecta `now`). Clampa a 0: nunca devuelve negativos aunque el frasco ya
 * se haya agotado o la fecha de apertura sea futura.
 */

export type StockCalcInput = {
  bottleOpenedAt?: string | null;
  totalPills?: number | null;
  pillsPerDay?: number | null;
};

export type DaysInfo = {
  daysRemaining: number | null;
  pillsRemaining: number | null;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function calcDaysRemaining(entry: StockCalcInput, now: number = Date.now()): DaysInfo {
  const { bottleOpenedAt, totalPills, pillsPerDay } = entry;
  // Sin datos suficientes, o ritmo no positivo (evita división inválida): desconocido.
  if (!bottleOpenedAt || totalPills == null || pillsPerDay == null || pillsPerDay <= 0) {
    return { daysRemaining: null, pillsRemaining: null };
  }
  const openedAt = new Date(bottleOpenedAt).getTime();
  if (Number.isNaN(openedAt)) {
    return { daysRemaining: null, pillsRemaining: null };
  }
  // Fecha futura → 0 días transcurridos (no negativo).
  const daysSinceOpened = Math.max(0, Math.floor((now - openedAt) / MS_PER_DAY));
  // Frasco agotado → 0, nunca negativo.
  const pillsRemaining = Math.max(0, totalPills - daysSinceOpened * pillsPerDay);
  const daysRemaining = Math.floor(pillsRemaining / pillsPerDay);
  return { daysRemaining, pillsRemaining };
}
