import { normalizeName } from "../import";

export interface DetectedRecurring {
  description: string;
  averageCents: number;
  months: number;
}

/**
 * Gastos que se repetem: mesma descrição em pelo menos três meses diferentes,
 * com valores parecidos (até 25% acima ou abaixo da média).
 */
export function detectRecurring(
  rows: { description: string; amount_cents: number; date: string }[],
  minMonths = 3,
): DetectedRecurring[] {
  const groups = new Map<string, { description: string; byMonth: Map<string, number> }>();
  for (const row of rows) {
    const key = normalizeName(row.description).replace(/\d+/g, "").trim();
    if (!key) continue;
    const group = groups.get(key) ?? { description: row.description, byMonth: new Map() };
    const month = row.date.slice(0, 7);
    group.byMonth.set(month, (group.byMonth.get(month) ?? 0) + row.amount_cents);
    groups.set(key, group);
  }

  const result: DetectedRecurring[] = [];
  for (const { description, byMonth } of groups.values()) {
    if (byMonth.size < minMonths) continue;
    const values = [...byMonth.values()];
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const stable = values.every((value) => Math.abs(value - average) <= average * 0.25);
    if (stable) {
      result.push({ description, averageCents: Math.round(average), months: byMonth.size });
    }
  }
  return result.sort((a, b) => b.averageCents - a.averageCents);
}
