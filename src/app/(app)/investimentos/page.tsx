import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import {
  INVESTMENT_TYPES,
  mapInvestments,
  summarizePortfolio,
  type Investment,
} from "@/lib/investments";
import { formatCents } from "@/lib/money";
import { isPluggyConfigured, listInvestments, pluggyItemIds } from "@/lib/pluggy";
import { perItem } from "@/lib/per-item";
import { requireDb } from "@/lib/supabase/server";

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    cents / 100,
  );
}

export default async function InvestmentsPage() {
  const db = await requireDb();

  if (!isPluggyConfigured()) {
    return (
      <>
        <PageHeader title="Investimentos" />
        <Card>
          <EmptyState
            message="Conecte seu banco para ver os investimentos."
            href="/open-finance"
            linkLabel="Ir para Open Finance"
          />
        </Card>
      </>
    );
  }

  const stored = await db.from("bank_items").select("item_id");
  if (stored.error) throw new Error(stored.error.message);
  const itemIds = [
    ...new Set([
      ...pluggyItemIds(),
      ...(stored.data as { item_id: string }[]).map((row) => row.item_id),
    ]),
  ];

  // Uma conexão com problema não esconde os investimentos das outras.
  const fetched = await perItem(itemIds, listInvestments);
  const investments: Investment[] = mapInvestments(
    fetched.results.flatMap(({ value }) => value),
  );
  const failed = itemIds.length > 0 && fetched.results.length === 0;
  const partial = !failed && fetched.failed.length > 0;

  const summary = summarizePortfolio(investments);
  const brl = investments.filter((item) => item.currencyCode === "BRL");

  return (
    <>
      <PageHeader title="Investimentos" />

      {failed && (
        <Card className="mb-4">
          <p role="alert" className="text-sm text-expense">
            Não foi possível buscar os investimentos na Pluggy. Tente novamente mais
            tarde.
          </p>
        </Card>
      )}

      {partial && (
        <Card className="mb-4">
          <p role="alert" className="text-sm text-expense">
            Uma ou mais conexões não responderam, então o total pode estar
            incompleto.
          </p>
        </Card>
      )}

      {!failed && investments.length === 0 ? (
        <Card>
          <EmptyState
            message="Nenhum investimento encontrado nas conexões. Confira se o banco compartilhou investimentos ao autorizar no Meu Pluggy."
            href="/open-finance"
            linkLabel="Ver conexões"
          />
        </Card>
      ) : (
        !failed && (
          <>
            <div className="mb-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <Card>
                <p className="text-sm text-muted">Total investido hoje</p>
                <p className="mt-1 whitespace-nowrap text-3xl font-semibold tracking-tight tabular-nums">
                  {formatCents(summary.totalCents)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Saldo líquido, já descontados impostos e taxas.
                </p>
                {summary.withProfit > 0 && (
                  <p className="mt-4 text-sm">
                    Rendimento informado:{" "}
                    <span
                      className={`font-semibold tabular-nums ${
                        summary.profitCents >= 0 ? "text-income" : "text-expense"
                      }`}
                    >
                      {summary.profitCents >= 0 ? "+ " : "- "}
                      {formatCents(Math.abs(summary.profitCents))}
                    </span>
                  </p>
                )}
                {summary.withoutProfit > 0 && (
                  <p className="mt-1 text-xs text-muted">
                    {summary.withoutProfit}{" "}
                    {summary.withoutProfit === 1 ? "investimento não informa" : "investimentos não informam"}{" "}
                    o rendimento pelo Open Finance.
                  </p>
                )}
              </Card>

              <Card>
                <h2 className="text-lg font-medium">Distribuição por tipo</h2>
                <div className="mt-4 flex h-7 gap-0.5 overflow-hidden rounded-lg">
                  {summary.byType.map((group) => (
                    <div
                      key={group.type}
                      className="hatch h-full"
                      title={`${group.label}: ${formatCents(group.cents)}`}
                      style={{
                        width: `${(group.cents / summary.totalCents) * 100}%`,
                        background: group.color,
                      }}
                    />
                  ))}
                </div>
                <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {summary.byType.map((group) => (
                    <li key={group.type} className="flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-sm"
                        style={{ background: group.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{group.label}</span>
                      <span className="tabular-nums">{formatCents(group.cents)}</span>
                      <span className="w-10 text-right text-muted tabular-nums">
                        {Math.round((group.cents / summary.totalCents) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {INVESTMENT_TYPES.map(({ type, label }) => {
              const rows = brl.filter((item) => item.type === type);
              if (rows.length === 0) return null;
              return (
                <Card key={type} className="mb-4">
                  <h2 className="mb-1 text-lg font-medium">{label}</h2>
                  <ul className="divide-y divide-line">
                    {rows.map((item) => (
                      <InvestmentItem key={item.id} item={item} />
                    ))}
                  </ul>
                </Card>
              );
            })}

            {summary.foreign.length > 0 && (
              <Card className="mb-4">
                <h2 className="mb-1 text-lg font-medium">Em outras moedas</h2>
                <p className="mb-1 text-xs text-muted">Fora do total em reais.</p>
                <ul className="divide-y divide-line">
                  {summary.foreign.map((item) => (
                    <InvestmentItem key={item.id} item={item} />
                  ))}
                </ul>
              </Card>
            )}

            <p className="text-xs text-muted">
              Dados enviados pelo banco via Open Finance, atualizados uma vez por dia.
              Investimentos não entram em receitas e despesas. Para movimentar, use{" "}
              <Link href="/lancamentos/novo" className="underline">
                uma transferência
              </Link>{" "}
              para uma conta do tipo investimento.
            </p>
          </>
        )
      )}
    </>
  );
}

function InvestmentItem({ item }: { item: Investment }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="text-xs text-muted">
          {item.detail}
          {item.dueDate && `${item.detail ? " · " : ""}Vence ${formatDate(item.dueDate)}`}
        </p>
      </div>
      <div className="text-right">
        <p className="whitespace-nowrap text-sm font-semibold tabular-nums">
          {formatMoney(item.balanceCents, item.currencyCode)}
        </p>
        {item.profitCents !== null && (
          <p
            className={`whitespace-nowrap text-xs tabular-nums ${
              item.profitCents >= 0 ? "text-income" : "text-expense"
            }`}
          >
            {item.profitCents >= 0 ? "+ " : "- "}
            {formatMoney(Math.abs(item.profitCents), item.currencyCode)}
          </p>
        )}
      </div>
    </li>
  );
}
