import {
  ArrowDownRight,
  ArrowUpRight,
  Ellipsis,
  History,
  Pencil,
  Plus,
  Receipt,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BankIcon, type Institution } from "@/components/bank-icon";
import { BudgetStatus } from "@/components/budget-status";
import { CreditCardVisual } from "@/components/credit-card-visual";
import { MonthNav } from "@/components/month-nav";
import { Card, EmptyState, textButtonClass } from "@/components/ui";
import { nextInvoiceToPay, usedLimitCents } from "@/lib/cards";
import {
  budgetLevel,
  dailySeries,
  effectiveBudgets,
  percentChange,
  projectMonthEnd,
  spendingByCategory,
  upcomingBills,
  type BudgetRow,
} from "@/lib/dashboard";
import {
  addDays,
  capitalizeFirst,
  formatDate,
  formatMonth,
  isValidMonth,
  monthBounds,
  shiftMonth,
  todayInBrazil,
} from "@/lib/dates";
import { loadGoalBalances } from "@/lib/goal-balances-server";
import { countGoalsByAccount, goalProgress } from "@/lib/goals";
import { formatCents } from "@/lib/money";
import { ensureRecurringGenerated } from "@/lib/recurring-server";
import { requireDb } from "@/lib/supabase/server";
import { summarizeMonth } from "@/lib/transactions";
import { setTransactionStatus } from "../lancamentos/actions";
import { GoalMeter } from "../metas/goal-meter";
import { Gauge } from "./gauge";
import { NetWorthCard } from "./net-worth";
import { ChartLegend, OverviewChart } from "./overview-chart";

const UPCOMING_DAYS = 30;
const CHART_DAYS = 7;
const TOP_CATEGORIES = 5;

interface MonthTransaction {
  id: string;
  type: string;
  status: "paid" | "pending";
  amount_cents: number;
  date: string;
  description: string;
  category_id: string | null;
  account: ({ name: string } & Institution) | null;
  invoice: { card: { name: string } & Institution } | null;
}

interface Invoice {
  id: string;
  card_id: string;
  due_date: string;
  paid_at: string | null;
  total_cents: number;
}

interface CreditCard {
  id: string;
  name: string;
  limit_cents: number;
  color: string | null;
  style: string | null;
  last_digits: string | null;
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
  const currentMonth = today.slice(0, 7);
  const month = mes && isValidMonth(mes) ? mes : currentMonth;
  const { start, end } = monthBounds(month);
  const previous = monthBounds(shiftMonth(month, -1));
  const currentMonthEnd = monthBounds(currentMonth).end;
  const until = addDays(today, UPCOMING_DAYS);
  const chartEnd = month === currentMonth ? today : addDays(end, -1);
  const chartDays = Array.from({ length: CHART_DAYS }, (_, i) =>
    addDays(chartEnd, i - CHART_DAYS + 1),
  );

  const results = await Promise.all([
    db
      .from("transactions")
      .select(
        `id, type, status, amount_cents, date, description, category_id,
         account:accounts!transactions_account_id_fkey(name, institution_name, institution_logo, institution_color),
         invoice:invoices(card:credit_cards(name, institution_name, institution_logo, institution_color))`,
      )
      .gte("date", start)
      .lt("date", end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    db
      .from("transactions")
      .select("type, amount_cents")
      .in("type", ["income", "expense"])
      .gte("date", previous.start)
      .lt("date", previous.end),
    db
      .from("transactions")
      .select("type, amount_cents, date")
      .in("type", ["income", "expense"])
      .gte("date", chartDays[0])
      .lte("date", chartEnd),
    db.from("account_balances").select("id, balance_cents, archived"),
    db
      .from("transactions")
      .select("id, description, date, amount_cents")
      .eq("type", "expense")
      .eq("status", "pending")
      .lte("date", until),
    db
      .from("invoice_totals")
      .select("id, card_id, due_date, paid_at, total_cents")
      .is("paid_at", null),
    db
      .from("credit_cards")
      .select("id, name, limit_cents, color, style, last_digits")
      .eq("archived", false)
      .order("name"),
    db.from("categories").select("id, name, color").eq("kind", "expense"),
    db.from("budgets").select("category_id, month, limit_cents").lte("month", start),
    db
      .from("transactions")
      .select("type, amount_cents")
      .eq("status", "pending")
      .in("type", ["income", "expense"])
      .lt("date", currentMonthEnd),
    db
      .from("goals")
      .select("id, name, target_cents, deadline, account_id, investment_id")
      .order("deadline"),
  ]);
  for (const result of results) {
    if (result.error) throw new Error(result.error.message);
  }
  const [
    monthResult,
    previousResult,
    chartResult,
    balancesResult,
    pendingResult,
    invoicesResult,
    cardsResult,
    categoriesResult,
    budgetsResult,
    monthPendingResult,
    goalsResult,
  ] = results;

  const rows = (monthResult.data ?? []) as unknown as MonthTransaction[];
  const summary = summarizeMonth(rows);
  const previousSummary = summarizeMonth(previousResult.data ?? []);
  const points = dailySeries(
    (chartResult.data ?? []) as { type: string; amount_cents: number; date: string }[],
    chartDays,
  );

  const balances = (balancesResult.data ?? []) as {
    id: string;
    balance_cents: number;
    archived: boolean;
  }[];
  const totalBalance = balances
    .filter((row) => !row.archived)
    .reduce((sum, row) => sum + row.balance_cents, 0);

  const openInvoices = (invoicesResult.data ?? []) as Invoice[];
  const cards = (cardsResult.data ?? []) as CreditCard[];
  const projection = projectMonthEnd(
    totalBalance,
    monthPendingResult.data ?? [],
    openInvoices.filter((invoice) => invoice.due_date < currentMonthEnd),
  );
  const bills = upcomingBills(
    pendingResult.data ?? [],
    openInvoices,
    new Map(cards.map((card) => [card.id, card.name])),
    today,
    until,
  ).slice(0, 4);

  const spending = spendingByCategory(rows);
  const limits = effectiveBudgets((budgetsResult.data ?? []) as BudgetRow[], month);
  const categories = (categoriesResult.data ?? []) as {
    id: string;
    name: string;
    color: string;
  }[];
  const ranked = categories
    .map((category) => ({ ...category, spent: spending.get(category.id) ?? 0 }))
    .filter((category) => category.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const topCategories = ranked.slice(0, TOP_CATEGORIES);
  const otherSpent = ranked
    .slice(TOP_CATEGORIES)
    .reduce((sum, category) => sum + category.spent, 0);
  const categoryTotal = ranked.reduce((sum, category) => sum + category.spent, 0);

  const budgetLimit = [...limits.values()].reduce((sum, value) => sum + value, 0);
  const budgetSpent = [...limits.keys()].reduce(
    (sum, id) => sum + (spending.get(id) ?? 0),
    0,
  );

  const savingsRate =
    summary.incomeCents > 0
      ? (summary.balanceCents / summary.incomeCents) * 100
      : null;

  const goals = goalsResult.data ?? [];
  // Metas ligadas a investimento precisam do saldo vindo da Pluggy.
  const balanceById = goals.some((goal) => goal.investment_id)
    ? (await loadGoalBalances(db, { withInvestments: true })).balances
    : new Map(balances.map((row) => [row.id, row.balance_cents]));
  const goalCounts = countGoalsByAccount(goals);
  const firstCard = cards[0];
  const firstCardInvoices = firstCard
    ? openInvoices.filter((invoice) => invoice.card_id === firstCard.id)
    : [];
  const firstCardNext = nextInvoiceToPay(firstCardInvoices);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <MonthNav basePath="/dashboard" month={month} />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* As colunas internas seguem a largura desta área, não a da tela. */}
        <div className="@container min-w-0 space-y-4">
          <div className="grid gap-4 @2xl:grid-cols-[minmax(0,1fr)_260px]">
            <Card>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="whitespace-nowrap text-3xl font-semibold tracking-tight tabular-nums @lg:text-4xl">
                    {formatCents(totalBalance)}
                  </p>
                  <p className="mt-1 text-sm text-muted">Saldo em contas hoje</p>
                </div>
                <ChartLegend />
              </div>
              <OverviewChart points={points} />
            </Card>

            <Card className="flex flex-col justify-between gap-6">
              <Kpi
                label="Receitas do mês"
                value={summary.incomeCents}
                change={percentChange(summary.incomeCents, previousSummary.incomeCents)}
                goodWhenUp
              />
              <Kpi
                label="Despesas do mês"
                value={summary.expenseCents}
                change={percentChange(summary.expenseCents, previousSummary.expenseCents)}
                goodWhenUp={false}
              />
              <Kpi
                label="Sobra do mês"
                value={summary.balanceCents}
                change={percentChange(summary.balanceCents, previousSummary.balanceCents)}
                goodWhenUp
              />
            </Card>
          </div>

          <div className="grid gap-4 @2xl:grid-cols-2">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Limite de gastos do mês</h2>
                  <p className="text-sm text-muted">Soma dos orçamentos por categoria</p>
                </div>
                <Link
                  href={`/orcamento?mes=${month}`}
                  aria-label="Editar orçamento"
                  className="rounded-lg p-1.5 hover:bg-soft"
                >
                  <Pencil className="size-[18px]" strokeWidth={1.6} aria-hidden />
                </Link>
              </div>
              {budgetLimit > 0 ? (
                <>
                  <div className="mt-6 h-7 overflow-hidden rounded-lg bg-soft">
                    <div
                      className={`hatch h-full rounded-lg ${
                        budgetSpent > budgetLimit ? "bg-expense" : "bg-brand"
                      }`}
                      style={{
                        width: `${Math.min(100, (budgetSpent / budgetLimit) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm tabular-nums">
                    <span className="font-medium">{formatCents(budgetSpent)}</span>
                    <span className="text-muted">{formatCents(budgetLimit)}</span>
                  </div>
                  <div className="mt-1">
                    <BudgetStatus level={budgetLevel(budgetSpent, budgetLimit)} />
                  </div>
                </>
              ) : (
                <EmptyState
                  message="Nenhum orçamento definido."
                  href={`/orcamento?mes=${month}`}
                  linkLabel="Definir orçamento"
                />
              )}
            </Card>

            <Card className="relative overflow-hidden">
              <div className="relative z-10 max-w-[70%]">
                <h2 className="text-lg font-medium">
                  Previsão para o fim de {formatMonth(currentMonth).split(" ")[0]}
                </h2>
                <p className="mt-2 whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums @[17rem]:text-3xl">
                  {formatCents(projection.projectedCents)}
                </p>
                <p className="mt-2 text-sm text-ink/80">
                  Saldo de hoje + {formatCents(projection.pendingIncomeCents)} a receber
                  − {formatCents(projection.pendingExpenseCents)} em contas −{" "}
                  {formatCents(projection.invoicesCents)} em faturas.
                </p>
                {projection.projectedCents < 0 && (
                  <p className="mt-1 text-xs font-medium text-expense">
                    ▲ O saldo previsto fica negativo
                  </p>
                )}
              </div>
              <Decoration />
            </Card>
          </div>

          <div className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
            <Card>
              <h2 className="text-lg font-medium">Gastos por categoria</h2>
              <p className="text-sm text-muted">{capitalizeFirst(formatMonth(month))}</p>
              <p className="mt-5 whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums @[17rem]:text-3xl">
                {formatCents(categoryTotal)}
              </p>
              {categoryTotal === 0 ? (
                <p className="mt-4 text-sm text-muted">Nenhum gasto neste mês.</p>
              ) : (
                <>
                  <div className="mt-4 flex h-7 gap-0.5 overflow-hidden rounded-lg">
                    {topCategories.map((category) => (
                      <div
                        key={category.id}
                        className="hatch h-full first:rounded-l-lg"
                        title={`${category.name}: ${formatCents(category.spent)}`}
                        style={{
                          width: `${(category.spent / categoryTotal) * 100}%`,
                          background: category.color,
                        }}
                      />
                    ))}
                    {otherSpent > 0 && (
                      <div
                        className="h-full bg-line"
                        title={`Outras: ${formatCents(otherSpent)}`}
                        style={{ width: `${(otherSpent / categoryTotal) * 100}%` }}
                      />
                    )}
                  </div>
                  <ul className="mt-5 space-y-2.5 text-sm">
                    {topCategories.map((category) => (
                      <CategoryLegend
                        key={category.id}
                        name={category.name}
                        color={category.color}
                        percent={(category.spent / categoryTotal) * 100}
                      />
                    ))}
                    {otherSpent > 0 && (
                      <CategoryLegend
                        name="Outras"
                        color="var(--color-line)"
                        percent={(otherSpent / categoryTotal) * 100}
                      />
                    )}
                  </ul>
                </>
              )}
            </Card>

            <Card>
              <h2 className="text-lg font-medium">Saúde financeira</h2>
              <p className="text-sm text-muted">Quanto da receita sobrou</p>
              <p className="mt-5 whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums @[17rem]:text-3xl">
                {formatCents(summary.balanceCents)}
              </p>
              {savingsRate === null ? (
                <p className="mt-6 text-sm text-muted">Sem receitas neste mês.</p>
              ) : (
                <>
                  <div className="relative mt-4">
                    <Gauge percent={savingsRate} />
                    <div className="absolute inset-x-0 bottom-0 text-center">
                      <p className="text-2xl font-semibold tabular-nums">
                        {Math.round(savingsRate)}%
                      </p>
                      <p className="text-xs text-muted">da receita do mês</p>
                    </div>
                  </div>
                  {savingsRate < 0 && (
                    <p className="mt-3 text-xs font-medium text-expense">
                      ▲ Você gastou mais do que recebeu
                    </p>
                  )}
                </>
              )}
              <p className="mt-4 text-sm text-ink/80">
                Calculado com os lançamentos de {formatMonth(month)}.
              </p>
            </Card>

            <Card className="@xl:col-span-2 @4xl:col-span-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium">Metas</h2>
                <Link
                  href="/metas"
                  className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-soft"
                >
                  <Plus className="size-4" aria-hidden />
                  Nova meta
                </Link>
              </div>
              {goals.length === 0 ? (
                <EmptyState message="Nenhuma meta ainda." />
              ) : (
                <ul className="mt-5 space-y-5">
                  {goals.slice(0, 4).map((goal) => (
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
              )}
            </Card>
          </div>
        </div>

        <div className="grid min-w-0 content-start gap-4 lg:grid-cols-2 2xl:grid-cols-1">
          <Suspense
            fallback={
              <Card>
                <p className="text-sm text-muted" role="status">
                  Calculando patrimônio...
                </p>
              </Card>
            }
          >
            <NetWorthCard />
          </Suspense>
          <Card>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">Meus cartões</h2>
                <p className="text-sm text-muted">Ações rápidas</p>
              </div>
              <Link
                href="/cartoes"
                className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-soft"
              >
                <Plus className="size-4" aria-hidden />
                Cartão
              </Link>
            </div>

            {cards.length === 0 ? (
              <EmptyState
                message="Cadastre um cartão para ver a fatura aqui."
                href="/cartoes"
                linkLabel="Cadastrar cartão"
              />
            ) : (
              <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
                {cards.map((card) => {
                  const invoices = openInvoices.filter((i) => i.card_id === card.id);
                  const next = nextInvoiceToPay(invoices);
                  return (
                    <Link
                      key={card.id}
                      href={next ? `/faturas/${next.id}` : `/cartoes/${card.id}`}
                      className="group w-36 shrink-0 snap-start"
                    >
                      <CreditCardVisual
                        card={card}
                        className="transition group-hover:-translate-y-1"
                      />
                      <p className="mt-3 text-xs text-muted">Fatura a pagar</p>
                      <p className="whitespace-nowrap font-semibold tabular-nums">
                        {formatCents(next?.total_cents ?? 0)}
                      </p>
                      <p className="text-xs text-muted">
                        {next ? `Vence ${formatDate(next.due_date)}` : "Nada a pagar"}
                      </p>
                      {card.limit_cents > 0 && (
                        <p className="text-xs text-muted tabular-nums">
                          Disponível {formatCents(card.limit_cents - usedLimitCents(invoices))}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="mt-5 grid grid-cols-5 gap-2 text-center text-xs">
              <QuickAction href="/lancamentos/novo" label="Novo" icon={Plus} />
              <QuickAction href="/importar" label="Importar" icon={Upload} />
              <QuickAction
                href={firstCardNext ? `/faturas/${firstCardNext.id}` : "/cartoes"}
                label="Pagar"
                icon={Receipt}
              />
              <QuickAction
                href={firstCard ? `/cartoes/${firstCard.id}` : "/cartoes"}
                label="Faturas"
                icon={History}
              />
              <QuickAction href="/cartoes" label="Mais" icon={Ellipsis} />
            </div>

            <h3 className="mt-6 mb-1 text-sm font-medium">Próximos vencimentos</h3>
            {bills.length === 0 ? (
              <p className="py-3 text-sm text-muted">Nada a vencer nos próximos 30 dias.</p>
            ) : (
              <ul className="divide-y divide-line">
                {bills.map((bill) => (
                  <li key={bill.key} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={bill.href} className="block truncate text-sm hover:underline">
                        {bill.label}
                      </Link>
                      <p className="text-xs text-muted">
                        {formatDate(bill.dueDate)}
                        {bill.overdue && (
                          <span className="ml-2 font-medium text-expense">▲ Atrasada</span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {formatCents(bill.amountCents)}
                      </p>
                      {bill.transactionId && (
                        <form action={setTransactionStatus.bind(null, bill.transactionId, "paid")}>
                          <button type="submit" className={`${textButtonClass} text-xs`}>
                            Marcar pago
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Transações</h2>
              <Link
                href={`/lancamentos?mes=${month}`}
                className="rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-soft"
              >
                Ver todas
              </Link>
            </div>
            <div className="flex justify-between border-b border-line pb-2 text-xs text-muted">
              <span>Nome</span>
              <span>Valor</span>
            </div>
            {rows.length === 0 ? (
              <EmptyState
                message="Nenhum lançamento neste mês."
                href="/lancamentos/novo"
                linkLabel="Criar lançamento"
              />
            ) : (
              <ul>
                {rows.slice(0, 8).map((row) => (
                  <li key={row.id} className="flex items-center gap-3 py-3">
                    <BankIcon
                      institution={row.account ?? row.invoice?.card}
                      fallbackName={row.account?.name ?? row.invoice?.card.name ?? row.description}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{row.description}</p>
                      <p className="text-xs text-muted">
                        {formatDate(row.date)} · {row.account?.name ?? row.invoice?.card.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm tabular-nums">
                        {row.type === "income" ? "+ " : row.type === "expense" ? "- " : ""}
                        {formatCents(row.amount_cents)}
                      </p>
                      <p
                        className={`text-xs ${
                          row.status === "pending" ? "text-pending" : "text-income"
                        }`}
                      >
                        {row.status === "pending" ? "Pendente" : "Pago"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  change,
  goodWhenUp,
}: {
  label: string;
  value: number;
  change: number | null;
  goodWhenUp: boolean;
}) {
  const up = change !== null && change >= 0;
  const good = change !== null && up === goodWhenUp;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;

  return (
    <div>
      <p className="text-sm">{label}</p>
      <p className="mt-1 whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums @[17rem]:text-3xl">
        {formatCents(value)}
      </p>
      {change === null ? (
        <p className="mt-1 text-xs text-muted">Sem base no mês anterior</p>
      ) : (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <span
            className={`flex items-center font-medium ${good ? "text-income" : "text-expense"}`}
          >
            <Arrow className="size-3.5" aria-hidden />
            {Math.abs(change).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </span>
          {up ? "a mais" : "a menos"} que o mês anterior
        </p>
      )}
    </div>
  );
}

function CategoryLegend({
  name,
  color,
  percent,
}: {
  name: string;
  color: string;
  percent: number;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-3 shrink-0 rounded-sm" style={{ background: color }} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="tabular-nums">{Math.round(percent)}%</span>
    </li>
  );
}

function QuickAction({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Plus;
}) {
  return (
    <Link href={href} className="group flex flex-col items-center gap-1.5">
      <span className="flex aspect-square w-full items-center justify-center rounded-xl border border-line group-hover:bg-soft">
        <Icon className="size-5" strokeWidth={1.6} aria-hidden />
      </span>
      {label}
    </Link>
  );
}

/** Blocos decorativos no canto, como no cartão de dicas da referência. */
function Decoration() {
  const cells = [
    "", "", "bg-brand",
    "", "bg-bar-expense/70", "bg-brand",
    "bg-brand/60", "bg-brand/60", "bg-brand",
    "bg-brand/40", "bg-bar-expense/70", "bg-brand",
  ];
  return (
    <div className="absolute top-4 right-4 grid grid-cols-3 gap-1" aria-hidden>
      {cells.map((cell, index) => (
        <span key={index} className={`hatch size-6 rounded ${cell}`} />
      ))}
    </div>
  );
}
