export interface BudgetRow {
  category_id: string;
  month: string;
  limit_cents: number;
}

/** Limite vigente por categoria: a linha mais recente até o mês consultado. */
export function effectiveBudgets(
  rows: BudgetRow[],
  month: string,
): Map<string, number> {
  const cutoff = `${month}-01`;
  const latest = new Map<string, BudgetRow>();
  for (const row of rows) {
    if (row.month > cutoff) continue;
    const current = latest.get(row.category_id);
    if (!current || row.month > current.month) latest.set(row.category_id, row);
  }

  const limits = new Map<string, number>();
  for (const [categoryId, row] of latest) {
    if (row.limit_cents > 0) limits.set(categoryId, row.limit_cents);
  }
  return limits;
}

export function spendingByCategory(
  rows: { type: string; category_id: string | null; amount_cents: number }[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== "expense" || !row.category_id) continue;
    totals.set(
      row.category_id,
      (totals.get(row.category_id) ?? 0) + row.amount_cents,
    );
  }
  return totals;
}

export type BudgetLevel = "ok" | "warning" | "over";

export function budgetLevel(spentCents: number, limitCents: number): BudgetLevel {
  if (spentCents > limitCents) return "over";
  return spentCents >= limitCents * 0.8 ? "warning" : "ok";
}

export interface MonthEndProjection {
  balanceCents: number;
  pendingIncomeCents: number;
  pendingExpenseCents: number;
  invoicesCents: number;
  projectedCents: number;
}

/** Recebe apenas o que vence até o fim do mês, inclusive o que está atrasado. */
export function projectMonthEnd(
  balanceCents: number,
  pending: { type: string; amount_cents: number }[],
  invoices: { total_cents: number }[],
): MonthEndProjection {
  const sumOf = (type: string) =>
    pending
      .filter((row) => row.type === type)
      .reduce((sum, row) => sum + row.amount_cents, 0);

  const pendingIncomeCents = sumOf("income");
  const pendingExpenseCents = sumOf("expense");
  const invoicesCents = invoices.reduce((sum, i) => sum + i.total_cents, 0);

  return {
    balanceCents,
    pendingIncomeCents,
    pendingExpenseCents,
    invoicesCents,
    projectedCents:
      balanceCents + pendingIncomeCents - pendingExpenseCents - invoicesCents,
  };
}

export interface UpcomingBill {
  key: string;
  label: string;
  dueDate: string;
  amountCents: number;
  overdue: boolean;
  href: string;
  transactionId?: string;
}

/** Contas pendentes e faturas em aberto até o limite, atrasadas primeiro. */
export function upcomingBills(
  pending: { id: string; description: string; date: string; amount_cents: number }[],
  invoices: { id: string; card_id: string; due_date: string; total_cents: number }[],
  cardNames: Map<string, string>,
  today: string,
  until: string,
): UpcomingBill[] {
  const bills: UpcomingBill[] = [
    ...pending
      .filter((item) => item.date <= until)
      .map((item) => ({
        key: `t-${item.id}`,
        label: item.description,
        dueDate: item.date,
        amountCents: item.amount_cents,
        overdue: item.date < today,
        href: `/lancamentos/${item.id}/editar`,
        transactionId: item.id,
      })),
    ...invoices
      .filter((invoice) => invoice.due_date <= until && invoice.total_cents > 0)
      .map((invoice) => ({
        key: `i-${invoice.id}`,
        label: `Fatura ${cardNames.get(invoice.card_id) ?? "do cartão"}`,
        dueDate: invoice.due_date,
        amountCents: invoice.total_cents,
        overdue: invoice.due_date < today,
        href: `/faturas/${invoice.id}`,
      })),
  ];
  return bills.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
