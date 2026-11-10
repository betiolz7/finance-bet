import { BudgetStatus } from "@/components/budget-status";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MonthNav } from "@/components/month-nav";
import {
  Card,
  EmptyState,
  PageHeader,
  inputClass,
  textButtonClass,
} from "@/components/ui";
import {
  budgetLevel,
  effectiveBudgets,
  spendingByCategory,
  type BudgetRow,
} from "@/lib/dashboard";
import { isValidMonth, monthBounds, todayInBrazil } from "@/lib/dates";
import { centsToInput, formatCents } from "@/lib/money";
import { ensureRecurringGenerated } from "@/lib/recurring-server";
import { requireDb } from "@/lib/supabase/server";
import { saveBudget } from "./actions";

interface Category {
  id: string;
  name: string;
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const db = await requireDb();
  await ensureRecurringGenerated();

  const month = mes && isValidMonth(mes) ? mes : todayInBrazil().slice(0, 7);
  const { start, end } = monthBounds(month);

  const [categories, budgets, transactions] = await Promise.all([
    db.from("categories").select("id, name").eq("kind", "expense").order("name"),
    db.from("budgets").select("category_id, month, limit_cents").lte("month", start),
    db
      .from("transactions")
      .select("type, category_id, amount_cents")
      .eq("type", "expense")
      .gte("date", start)
      .lt("date", end),
  ]);
  if (categories.error) throw new Error(categories.error.message);
  if (budgets.error) throw new Error(budgets.error.message);
  if (transactions.error) throw new Error(transactions.error.message);

  const limits = effectiveBudgets(budgets.data as BudgetRow[], month);
  const spending = spendingByCategory(transactions.data);
  const rows = (categories.data as Category[]).map((category) => ({
    ...category,
    spent: spending.get(category.id) ?? 0,
    limit: limits.get(category.id),
  }));

  const budgeted = rows.filter((row) => row.limit !== undefined);
  const totalLimit = budgeted.reduce((sum, row) => sum + (row.limit ?? 0), 0);
  const totalSpent = budgeted.reduce((sum, row) => sum + row.spent, 0);

  return (
    <>
      <PageHeader
        title="Orçamento"
        action={<MonthNav basePath="/orcamento" month={month} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Orçado" value={totalLimit} />
        <Stat label="Gasto nas categorias orçadas" value={totalSpent} />
        <Stat label="Disponível" value={totalLimit - totalSpent} />
      </div>

      <Card>
        <p className="mb-2 text-sm text-muted">
          O limite vale deste mês em diante, até você mudar. Deixe em branco para
          remover.
        </p>
        {rows.length === 0 ? (
          <EmptyState
            message="Cadastre categorias de despesa para criar um orçamento."
            href="/categorias"
            linkLabel="Cadastrar categorias"
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const level =
                row.limit === undefined ? null : budgetLevel(row.spent, row.limit);
              const percent = row.limit
                ? Math.min(100, (row.spent / row.limit) * 100)
                : 0;
              return (
                <li key={`${row.id}-${month}-${row.limit ?? 0}`} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate text-sm font-medium">{row.name}</p>
                      <p className="flex flex-wrap gap-x-2 text-xs text-muted tabular-nums">
                        <span>
                          {formatCents(row.spent)} gastos
                          {row.limit !== undefined &&
                            ` de ${formatCents(row.limit)}`}
                        </span>
                        {level && <BudgetStatus level={level} />}
                      </p>
                    </div>
                    <ActionForm
                      action={saveBudget.bind(null, row.id, month)}
                      className="flex flex-wrap items-center justify-end gap-2"
                    >
                      <input
                        name="limit"
                        inputMode="decimal"
                        placeholder="Sem limite"
                        aria-label={`Limite de ${row.name}`}
                        defaultValue={
                          row.limit === undefined ? "" : centsToInput(row.limit)
                        }
                        className={`${inputClass} w-32 py-1 text-right tabular-nums`}
                      />
                      <SubmitButton className={textButtonClass}>Salvar</SubmitButton>
                    </ActionForm>
                  </div>
                  {row.limit !== undefined && (
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas">
                      <div
                        className={`h-full rounded-full ${
                          level === "over" ? "bg-expense" : "bg-chart"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {formatCents(value)}
      </p>
    </Card>
  );
}
