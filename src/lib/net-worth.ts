import { shiftMonth } from "./dates";

export interface Snapshot {
  month: string;
  accounts_cents: number;
  investments_cents: number;
}

export interface NetWorthPoint {
  month: string;
  totalCents: number | null;
}

/** Últimos N meses até o atual, com null nos meses sem registro. */
export function netWorthSeries(snapshots: Snapshot[], currentMonth: string, months = 12): NetWorthPoint[] {
  const byMonth = new Map(
    snapshots.map((s) => [s.month.slice(0, 7), s.accounts_cents + s.investments_cents]),
  );
  return Array.from({ length: months }, (_, i) => {
    const month = shiftMonth(currentMonth, i - months + 1);
    return { month, totalCents: byMonth.get(month) ?? null };
  });
}

/** Variação contra o mês anterior que tem registro, ou null se não houver. */
export function netWorthChange(points: NetWorthPoint[]): number | null {
  const known = points.filter((p) => p.totalCents !== null);
  if (known.length < 2) return null;
  return (known.at(-1)!.totalCents as number) - (known.at(-2)!.totalCents as number);
}
