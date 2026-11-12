import Link from "next/link";
import { Card } from "@/components/ui";
import { formatMonth, todayInBrazil } from "@/lib/dates";
import { loadInvestments } from "@/lib/investments-server";
import { formatCents, formatCompactCents } from "@/lib/money";
import { netWorthChange, netWorthSeries, type Snapshot } from "@/lib/net-worth";
import { requireDb } from "@/lib/supabase/server";

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * Patrimônio: saldo das contas mais investimentos. Guarda um registro por mês,
 * então o gráfico de evolução se completa com o tempo.
 */
export async function NetWorthCard() {
  const db = await requireDb();
  const currentMonth = todayInBrazil().slice(0, 7);

  const [balances, investments] = await Promise.all([
    db.from("account_balances").select("balance_cents").eq("archived", false),
    loadInvestments(db),
  ]);
  if (balances.error) throw new Error(balances.error.message);

  const accountsCents = (balances.data ?? []).reduce((sum, row) => sum + row.balance_cents, 0);
  const totalCents = accountsCents + investments.totalCents;

  // Só registra quando todas as conexões responderam, para não gravar um total incompleto.
  if (!investments.incomplete) {
    await db.from("net_worth_snapshots").upsert(
      {
        month: `${currentMonth}-01`,
        accounts_cents: accountsCents,
        investments_cents: investments.totalCents,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,month" },
    );
  }

  const { data: snapshots } = await db
    .from("net_worth_snapshots")
    .select("month, accounts_cents, investments_cents")
    .order("month", { ascending: false })
    .limit(12);
  const points = netWorthSeries((snapshots ?? []) as Snapshot[], currentMonth);
  const change = netWorthChange(points);
  const max = Math.max(1, ...points.map((p) => Math.max(0, p.totalCents ?? 0)));
  const known = points.filter((p) => p.totalCents !== null).length;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Patrimônio</h2>
          <p className="text-sm text-muted">Contas + investimentos</p>
        </div>
        <Link href="/investimentos" className="text-sm text-muted underline-offset-2 hover:underline">
          Investimentos
        </Link>
      </div>

      <p className="mt-4 whitespace-nowrap text-3xl font-semibold tracking-tight tabular-nums">
        {formatCents(totalCents)}
      </p>
      {change !== null && (
        <p className={`text-xs font-medium ${change >= 0 ? "text-income" : "text-expense"}`}>
          {change >= 0 ? "▲" : "▼"} {formatCents(Math.abs(change))} desde o mês anterior
        </p>
      )}
      {investments.incomplete && (
        <p className="text-xs text-expense">Uma conexão não respondeu: total incompleto.</p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Contas</dt>
          <dd className="font-medium tabular-nums">{formatCents(accountsCents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Investimentos</dt>
          <dd className="font-medium tabular-nums">{formatCents(investments.totalCents)}</dd>
        </div>
      </dl>

      <figure className="mt-5">
        <figcaption className="sr-only">Patrimônio no fim de cada mês</figcaption>
        <div className="flex h-24 items-end gap-1.5">
          {points.map((point) => (
            <div
              key={point.month}
              className="group relative flex h-full flex-1 items-end"
              title={
                point.totalCents === null
                  ? `${formatMonth(point.month)}: sem registro`
                  : `${formatMonth(point.month)}: ${formatCents(point.totalCents)}`
              }
            >
              <div
                className={`w-full rounded-t ${point.totalCents === null ? "bg-soft" : "hatch bg-chart"}`}
                style={{
                  height:
                    point.totalCents === null
                      ? "4px"
                      : `max(4px, ${(Math.max(0, point.totalCents) / max) * 100}%)`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5 text-center text-[10px] text-muted">
          {points.map((point) => (
            <span key={point.month} className="flex-1">
              {MONTH_INITIALS[Number(point.month.slice(5, 7)) - 1]}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          {known <= 1
            ? "O histórico começa este mês e cresce a cada mês."
            : `Maior valor: ${formatCompactCents(max)}`}
        </p>
      </figure>
    </Card>
  );
}
