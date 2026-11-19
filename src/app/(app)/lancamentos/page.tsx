import Link from "next/link";
import { MonthNav } from "@/components/month-nav";
import { Card, EmptyState, PageHeader, textButtonClass } from "@/components/ui";
import {
  isValidMonth,
  monthBounds,
  todayInBrazil,
} from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { ensureRecurringGenerated } from "@/lib/recurring-server";
import { requireDb } from "@/lib/supabase/server";
import { summarizeMonth } from "@/lib/transactions";
import {
  LISTED_TRANSACTION_SELECT,
  TransactionItem,
  type ListedTransaction,
} from "./transaction-item";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; busca?: string; tipo?: string }>;
}) {
  const { mes, busca, tipo } = await searchParams;
  const search = busca?.trim().slice(0, 100) ?? "";
  const tab: Tab =
    tipo === "receitas" || tipo === "despesas" || tipo === "transferencias" ? tipo : "todos";
  const db = await requireDb();
  await ensureRecurringGenerated();

  const month = mes && isValidMonth(mes) ? mes : todayInBrazil().slice(0, 7);
  const { start, end } = monthBounds(month);

  let query = db
    .from("transactions")
    .select(LISTED_TRANSACTION_SELECT)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  // A busca procura em todos os meses. Sem busca, mostra só o mês escolhido.
  query = search
    ? query
        .ilike("description", `%${search.replace(/[\\%_]/g, "\\$&")}%`)
        .limit(200)
    : query.gte("date", start).lt("date", end);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const allRows = data as unknown as ListedTransaction[];
  const summary = summarizeMonth(allRows);
  const incomeRows = allRows.filter((row) => row.type === "income");
  const expenseRows = allRows.filter((row) => row.type === "expense");
  // Movimentos entre contas suas e pagamentos de fatura: nem receita nem despesa.
  const transferRows = allRows.filter(
    (row) => row.type === "transfer" || row.type === "invoice_payment",
  );
  const rows =
    tab === "receitas"
      ? incomeRows
      : tab === "despesas"
        ? expenseRows
        : tab === "transferencias"
          ? transferRows
          : allRows;

  // Filtros que a troca de aba e de mês precisam manter.
  const keep: Record<string, string> = search ? { busca: search } : { mes: month };
  const tabHref = (target: Tab) =>
    `/lancamentos?${new URLSearchParams(target === "todos" ? keep : { ...keep, tipo: target })}`;
  const emptyMessage = search
    ? "Nada encontrado."
    : tab === "receitas"
      ? "Nenhuma receita neste mês."
      : tab === "despesas"
        ? "Nenhuma despesa neste mês."
        : tab === "transferencias"
          ? "Nenhuma transferência neste mês."
          : "Nenhum lançamento neste mês.";

  return (
    <>
      <PageHeader
        title={search ? `Busca: "${search}"` : "Lançamentos"}
        action={
          search ? (
            <Link href="/lancamentos" className={textButtonClass}>
              Limpar busca
            </Link>
          ) : (
            <MonthNav
              basePath="/lancamentos"
              month={month}
              query={tab === "todos" ? {} : { tipo: tab }}
            />
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Summary
          label="Receitas"
          value={summary.incomeCents}
          href={tabHref("receitas")}
          active={tab === "receitas"}
          tone="text-income"
        />
        <Summary
          label="Despesas"
          value={summary.expenseCents}
          href={tabHref("despesas")}
          active={tab === "despesas"}
          tone="text-expense"
        />
        <Summary
          label={search ? "Saldo da busca" : "Sobra do mês"}
          value={summary.balanceCents}
          href={tabHref("todos")}
          active={tab === "todos"}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Tipo de lançamento"
          className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface p-1"
        >
          {(
            [
              ["todos", "Todos", allRows.length],
              ["receitas", "Receitas", incomeRows.length],
              ["despesas", "Despesas", expenseRows.length],
              ["transferencias", "Transferências", transferRows.length],
            ] as const
          ).map(([value, label, count]) => (
            <Link
              key={value}
              href={tabHref(value)}
              aria-current={tab === value ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${
                tab === value ? "bg-ink font-medium text-on-ink" : "text-muted hover:text-ink"
              }`}
            >
              {label} <span className="tabular-nums opacity-70">{count}</span>
            </Link>
          ))}
        </nav>
        {(tab === "receitas" || tab === "despesas") && (
          <Link
            href={`/lancamentos/novo?tipo=${tab === "receitas" ? "receita" : "despesa"}`}
            className={textButtonClass}
          >
            + Nova {tab === "receitas" ? "receita" : "despesa"}
          </Link>
        )}
        <div className="flex items-center gap-4">
          {tab === "transferencias" && (
            <Link href="/lancamentos/novo?tipo=transferencia" className={textButtonClass}>
              + Nova transferência
            </Link>
          )}
          {!search && (
            <a
              href={`/api/exportar?${new URLSearchParams(
                tab === "todos" ? { mes: month } : { mes: month, tipo: tab },
              )}`}
              className={textButtonClass}
              download
            >
              Exportar Excel
            </a>
          )}
        </div>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            message={emptyMessage}
            href={
              tab === "receitas"
                ? "/lancamentos/novo?tipo=receita"
                : "/lancamentos/novo"
            }
            linkLabel="Criar lançamento"
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <TransactionItem key={row.id} row={row} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

type Tab = "todos" | "receitas" | "despesas" | "transferencias";

function Summary({
  label,
  value,
  href,
  active,
  tone = "",
}: {
  label: string;
  value: number;
  href: string;
  active: boolean;
  tone?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`block rounded-[20px] bg-surface p-5 transition md:p-6 ${
        active ? "ring-2 ring-ink" : "hover:bg-soft"
      }`}
    >
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums ${tone}`}>
        {formatCents(value)}
      </p>
    </Link>
  );
}
