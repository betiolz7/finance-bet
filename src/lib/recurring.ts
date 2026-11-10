import { isValidMonth, shiftMonth } from "./dates";
import { parseMoneyToCents } from "./money";

export interface RecurringFields {
  description: string;
  amount: string;
  dueDay: string;
  categoryId: string;
  accountId: string;
}

export interface RecurringRow {
  description: string;
  amount_cents: number;
  due_day: number;
  category_id: string;
  account_id: string;
}

export type ParsedRecurring =
  | { ok: true; data: RecurringRow }
  | { ok: false; error: string };

export function parseRecurringInput(fields: RecurringFields): ParsedRecurring {
  const fail = (error: string): ParsedRecurring => ({ ok: false, error });

  const description = fields.description.trim();
  if (!description) return fail("Informe uma descrição.");

  const cents = parseMoneyToCents(fields.amount);
  if (cents === null) return fail("Informe um valor válido, como 1.234,56.");
  if (cents <= 0) return fail("O valor precisa ser maior que zero.");

  const dueDay = Number(fields.dueDay);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    return fail("O dia de vencimento precisa estar entre 1 e 31.");
  }

  if (!fields.categoryId) return fail("Escolha a categoria.");
  if (!fields.accountId) return fail("Escolha a conta.");

  return {
    ok: true,
    data: {
      description,
      amount_cents: cents,
      due_day: dueDay,
      category_id: fields.categoryId,
      account_id: fields.accountId,
    },
  };
}

/** Converte "2026-11" no primeiro dia do mês, como é guardado no banco. */
export function monthToDate(month: string): string | null {
  return isValidMonth(month) ? `${month}-01` : null;
}

/**
 * Ao reativar, os meses em que o custo ficou pausado não devem ser gerados.
 * O próximo lançamento passa a ser o do mês atual.
 */
export function generatedThroughOnResume(
  generatedThrough: string | null,
  currentMonth: string,
): string {
  const previous = `${shiftMonth(currentMonth, -1)}-01`;
  return generatedThrough && generatedThrough > previous
    ? generatedThrough
    : previous;
}

export interface FixedCostSummary {
  paidCents: number;
  pendingCents: number;
}

export function summarizeFixedCosts(
  rows: { status: "pending" | "paid"; amount_cents: number }[],
): FixedCostSummary {
  let paidCents = 0;
  let pendingCents = 0;
  for (const row of rows) {
    if (row.status === "paid") paidCents += row.amount_cents;
    else pendingCents += row.amount_cents;
  }
  return { paidCents, pendingCents };
}
