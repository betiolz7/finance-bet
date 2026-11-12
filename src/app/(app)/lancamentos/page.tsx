import Link from "next/link";
import { BankIcon, type Institution } from "@/components/bank-icon";
import { ConfirmButton } from "@/components/forms";
import { MonthNav } from "@/components/month-nav";
import { Card, EmptyState, PageHeader, textButtonClass } from "@/components/ui";
import {
  formatDate,
  isValidMonth,
  monthBounds,
  todayInBrazil,
} from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { ensureRecurringGenerated } from "@/lib/recurring-server";
import { requireDb } from "@/lib/supabase/server";
import {
  summarizeMonth,
  type TransactionStatus,
  type TransactionType,
} from "@/lib/transactions";
import { deleteTransaction, setTransactionStatus } from "./actions";

type ListedType = TransactionType | "invoice_payment";

interface ListedTransaction {
  id: string;
  type: ListedType;
  status: TransactionStatus;
  amount_cents: number;
  date: string;
  description: string;
  recurring_rule_id: string | null;
  invoice_id: string | null;
  installment_number: number | null;
  installment_total: number | null;
  category: { name: string; color: string } | null;
  account: ({ name: string } & Institution) | null;
  to_account: { name: string } | null;
  invoice: { card: { name: string } & Institution } | null;
}

const AMOUNT_STYLE: Record<ListedType, { sign: string; className: string }> = {
  income: { sign: "+ ", className: "text-income" },
  expense: { sign: "- ", className: "text-expense" },
  transfer: { sign: "", className: "text-ink" },
  invoice_payment: { sign: "", className: "text-ink" },
};

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
    .select(
      `id, type, status, amount_cents, date, description, recurring_rule_id,
       invoice_id, installment_number, installment_total,
       invoice:invoices(card:credit_cards(name, institution_name, institution_logo, institution_color)),
       category:categories(name, color),
       account:accounts!transactions_account_id_fkey(name, institution_name, institution_logo, institution_color),
       to_account:accounts!transactions_to_account_id_fkey(name)`,
    )
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

function TransactionItem({ row }: { row: ListedTransaction }) {
  const style = AMOUNT_STYLE[row.type];
  const nextStatus = row.status === "paid" ? "pending" : "paid";
  const installment =
    row.installment_total && row.installment_total > 1
      ? ` (${row.installment_number}/${row.installment_total})`
      : "";

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <BankIcon
        institution={row.account ?? row.invoice?.card}
        fallbackName={row.account?.name ?? row.invoice?.card.name ?? "?"}
      />
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium">
          {row.description}
          {installment}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>{formatDate(row.date)}</span>
          {row.category && (
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: row.category.color }}
              />
              {row.category.name}
            </span>
          )}
          <span>
            {row.account?.name ?? row.invoice?.card.name}
            {row.to_account && ` → ${row.to_account.name}`}
          </span>
          {row.recurring_rule_id && (
            <span className="rounded bg-canvas px-1.5 py-0.5 font-medium">Fixo</span>
          )}
          {row.status === "pending" && (
            <span className="rounded bg-pending-soft px-1.5 py-0.5 font-medium text-pending">
              Pendente
            </span>
          )}
        </p>
      </div>

      <p className={`text-sm font-semibold tabular-nums ${style.className}`}>
        {style.sign}
        {formatCents(row.amount_cents)}
      </p>

      {row.invoice_id ? (
        <Link href={`/faturas/${row.invoice_id}`} className={textButtonClass}>
          Ver fatura
        </Link>
      ) : (
        <div className="flex items-center gap-3">
          <form action={setTransactionStatus.bind(null, row.id, nextStatus)}>
            <button type="submit" className={textButtonClass}>
              {row.status === "paid" ? "Desfazer pgto." : "Marcar pago"}
            </button>
          </form>
          <Link href={`/lancamentos/${row.id}/editar`} className={textButtonClass}>
            Editar
          </Link>
          <form action={deleteTransaction.bind(null, row.id)}>
            <ConfirmButton
              message={`Apagar "${row.description}"?`}
              className={textButtonClass}
            >
              Apagar
            </ConfirmButton>
          </form>
        </div>
      )}
    </li>
  );
}
