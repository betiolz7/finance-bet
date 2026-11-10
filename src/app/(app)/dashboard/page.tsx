import Link from "next/link";
import { BudgetStatus } from "@/components/budget-status";
import { MonthNav } from "@/components/month-nav";
import { Card, EmptyState, PageHeader, textButtonClass } from "@/components/ui";
import {
  budgetLevel,
  effectiveBudgets,
  projectMonthEnd,
  spendingByCategory,
  upcomingBills,
  type BudgetRow,
  type UpcomingBill,
} from "@/lib/dashboard";
import {
  addDays,
  formatDate,
  isValidMonth,
  monthBounds,
  todayInBrazil,
} from "@/lib/dates";
import { countGoalsByAccount, goalProgress } from "@/lib/goals";
import { formatCents } from "@/lib/money";
import { ensureRecurringGenerated } from "@/lib/recurring-server";
import { requireDb } from "@/lib/supabase/server";
import { summarizeMonth } from "@/lib/transactions";
import { setTransactionStatus } from "../lancamentos/actions";
import { GoalMeter } from "../metas/goal-meter";

const UPCOMING_DAYS = 30;
const RECENT_COUNT = 6;
const DASHBOARD_GOALS = 3;

interface MonthTransaction {
  id: string;
  type: string;
  amount_cents: number;
  date: string;
  description: string;
  category_id: string | null;
  account: { name: string } | null;
  invoice: { card: { name: string } } | null;
}

interface Category {
  id: string;
  name: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const db = await requireDb();
  await ensureRecurringGenerated();

  const today = todayInBrazil();
  const month = mes && isValidMonth(mes) ? mes : today.slice(0, 7);
  const { start, end } = monthBounds(month);
  const until = addDays(today, UPCOMING_DAYS);
  const currentMonth = today.slice(0, 7);
  const currentMonthEnd = monthBounds(currentMonth).end;

  const [
    transactions,
    balances,
    pending,
    invoices,
    cards,
    categories,
    budgets,
    monthPending,
    monthInvoices,
    goals,
  ] = await Promise.all([
      db
        .from("transactions")
        .select(
          `id, type, amount_cents, date, description, category_id,
           account:accounts!transactions_account_id_fkey(name),
           invoice:invoices(card:credit_cards(name))`,
        )
        .gte("date", start)
        .lt("date", end)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      db.from("account_balances").select("id, balance_cents, archived"),
      db
        .from("transactions")
        .select("id, description, date, amount_cents")
        .eq("type", "expense")
        .eq("status", "pending")
        .lte("date", until),
      db
        .from("invoice_totals")
        .select("id, card_id, due_date, total_cents")
        .is("paid_at", null)
        .lte("due_date", until),
      db.from("credit_cards").select("id, name"),
      db.from("categories").select("id, name").eq("kind", "expense"),
      db
        .from("budgets")
        .select("category_id, month, limit_cents")
        .lte("month", start),
      db
        .from("transactions")
        .select("type, amount_cents")
        .eq("status", "pending")
        .in("type", ["income", "expense"])
        .lt("date", currentMonthEnd),
      db
        .from("invoice_totals")
        .select("total_cents")
        .is("paid_at", null)
        .lt("due_date", currentMonthEnd),
      db
        .from("goals")
        .select("id, name, target_cents, deadline, account_id")
        .order("deadline"),
    ]);

  for (const result of [
    transactions,
    balances,
    pending,
    invoices,
    cards,
    categories,
    budgets,
    monthPending,
    monthInvoices,
    goals,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const rows = (transactions.data ?? []) as unknown as MonthTransaction[];
  const summary = summarizeMonth(rows);
  const allBalances = (balances.data ?? []) as {
    id: string;
    balance_cents: number;
    archived: boolean;
  }[];
  const totalBalance = allBalances
    .filter((row) => !row.archived)
    .reduce((sum, row) => sum + row.balance_cents, 0);
  const projection = projectMonthEnd(
    totalBalance,
    monthPending.data ?? [],
    monthInvoices.data ?? [],
  );
  const goalRows = goals.data ?? [];
  const balanceById = new Map(allBalances.map((row) => [row.id, row.balance_cents]));
  const goalCounts = countGoalsByAccount(goalRows);
  const savedPercent =
    summary.incomeCents > 0
      ? Math.round((summary.balanceCents / summary.incomeCents) * 100)
      : null;

  const bills = upcomingBills(
    pending.data ?? [],
    invoices.data ?? [],
    new Map((cards.data ?? []).map((card) => [card.id, card.name])),
    today,
    until,
  );

  const spending = spendingByCategory(rows);
  const limits = effectiveBudgets((budgets.data ?? []) as BudgetRow[], month);
  const categoryRows = ((categories.data ?? []) as Category[])
    .map((category) => ({
      ...category,
      spent: spending.get(category.id) ?? 0,
      limit: limits.get(category.id),
    }))
    .filter((category) => category.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const largest = categoryRows[0]?.spent ?? 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        action={<MonthNav basePath="/dashboard" month={month} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Saldo em contas hoje" value={totalBalance} />
        <Stat label="Receitas do mês" value={summary.incomeCents} />
        <Stat label="Despesas do mês" value={summary.expenseCents} />
        <Stat
          label="Sobra do mês"
          value={summary.balanceCents}
          note={savedPercent === null ? undefined : `${savedPercent}% das receitas`}
        />
      </div>

      {month === currentMonth && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <p className="text-sm text-muted">Previsão de saldo no fim do mês</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                {formatCents(projection.projectedCents)}
              </p>
              {projection.projectedCents < 0 && (
                <p className="mt-0.5 text-xs font-medium text-expense">
                  ▲ O saldo previsto fica negativo
                </p>
              )}
            </div>
            <dl className="grid flex-1 basis-72 grid-cols-3 gap-3 text-xs text-muted">
              <ProjectionPart label="A receber" value={projection.pendingIncomeCents} sign="+" />
              <ProjectionPart label="Contas a pagar" value={projection.pendingExpenseCents} sign="-" />
              <ProjectionPart label="Faturas do mês" value={projection.invoicesCents} sign="-" />
            </dl>
          </div>
        </Card>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Gastos por categoria</h2>
            <Link href={`/orcamento?mes=${month}`} className={textButtonClass}>
              Orçamento
            </Link>
          </div>
          {categoryRows.length === 0 ? (
            <EmptyState message="Nenhum gasto neste mês." />
          ) : (
            <ul className="space-y-3">
              {categoryRows.map((category) => (
                <li key={category.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{category.name}</span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatCents(category.spent)}
                    </span>
                  </div>
                  <div
                    className="mt-1 h-2 rounded-r bg-chart"
                    title={`${category.name}: ${formatCents(category.spent)}`}
                    style={{ width: `${(category.spent / largest) * 100}%` }}
                  />
                  {category.limit !== undefined && (
                    <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted tabular-nums">
                      <span>Orçamento de {formatCents(category.limit)}</span>
                      <BudgetStatus level={budgetLevel(category.spent, category.limit)} />
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Contas a vencer</h2>
          <p className="mb-2 text-xs text-muted">Atrasadas e próximos {UPCOMING_DAYS} dias</p>
          {bills.length === 0 ? (
            <EmptyState message="Nada a vencer." />
          ) : (
            <ul className="divide-y divide-line">
              {bills.map((bill) => (
                <BillItem key={bill.key} bill={bill} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {goalRows.length > 0 && (
        <Card className="mb-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Metas</h2>
            <Link href="/metas" className={textButtonClass}>
              Ver todas
            </Link>
          </div>
          <ul className="space-y-4">
            {goalRows.slice(0, DASHBOARD_GOALS).map((goal) => (
              <li key={goal.id}>
                <GoalMeter
                  name={goal.name}
                  targetCents={goal.target_cents}
                  deadline={goal.deadline}
                  progress={goalProgress(goal, balanceById, goalCounts, today)}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Últimas transações</h2>
          <Link href={`/lancamentos?mes=${month}`} className={textButtonClass}>
            Ver todas
          </Link>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            message="Nenhum lançamento neste mês."
            href="/lancamentos/novo"
            linkLabel="Criar lançamento"
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.slice(0, RECENT_COUNT).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.description}</p>
                  <p className="text-xs text-muted">
                    {formatDate(row.date)} ·{" "}
                    {row.account?.name ?? row.invoice?.card.name}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {row.type === "income" ? "+ " : row.type === "expense" ? "- " : ""}
                  {formatCents(row.amount_cents)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {formatCents(value)}
      </p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </Card>
  );
}

function ProjectionPart({
  label,
  value,
  sign,
}: {
  label: string;
  value: number;
  sign: "+" | "-";
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums text-ink">
        {sign} {formatCents(value)}
      </dd>
    </div>
  );
}

function BillItem({ bill }: { bill: UpcomingBill }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3">
      <div className="min-w-0 flex-1 basis-32">
        <Link href={bill.href} className="block truncate text-sm font-medium hover:underline">
          {bill.label}
        </Link>
        <p className="text-xs text-muted">
          {formatDate(bill.dueDate)}
          {bill.overdue && (
            <span className="ml-2 font-medium text-expense">▲ Atrasada</span>
          )}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums">
          {formatCents(bill.amountCents)}
        </p>
        {bill.transactionId && (
          <form action={setTransactionStatus.bind(null, bill.transactionId, "paid")}>
            <button type="submit" className={textButtonClass}>
              Marcar pago
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
