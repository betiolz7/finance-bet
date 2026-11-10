import { isValidDate } from "./dates";
import { parseMoneyToCents } from "./money";

export type TransactionType = "income" | "expense" | "transfer";
export type TransactionStatus = "pending" | "paid";

export interface TransactionFields {
  type: string;
  status: string;
  amount: string;
  date: string;
  description: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
}

export interface TransactionRow {
  type: TransactionType;
  status: TransactionStatus;
  amount_cents: number;
  date: string;
  description: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
}

export type ParsedTransaction =
  | { ok: true; data: TransactionRow }
  | { ok: false; error: string };

function isType(value: string): value is TransactionType {
  return value === "income" || value === "expense" || value === "transfer";
}

export function parseTransactionInput(
  fields: TransactionFields,
): ParsedTransaction {
  const fail = (error: string): ParsedTransaction => ({ ok: false, error });

  if (!isType(fields.type)) return fail("Escolha o tipo do lançamento.");
  if (fields.status !== "pending" && fields.status !== "paid") {
    return fail("Escolha a situação do lançamento.");
  }

  const cents = parseMoneyToCents(fields.amount);
  if (cents === null) return fail("Informe um valor válido, como 1.234,56.");
  if (cents <= 0) return fail("O valor precisa ser maior que zero.");

  if (!isValidDate(fields.date)) return fail("Informe uma data válida.");

  const description = fields.description.trim();
  if (!description) return fail("Informe uma descrição.");
  if (!fields.accountId) return fail("Escolha a conta.");

  const base = {
    type: fields.type,
    status: fields.status,
    amount_cents: cents,
    date: fields.date,
    description,
    account_id: fields.accountId,
  } as const;

  if (fields.type === "transfer") {
    if (!fields.toAccountId) return fail("Escolha a conta de destino.");
    if (fields.toAccountId === fields.accountId) {
      return fail("A conta de destino precisa ser diferente da conta de origem.");
    }
    return {
      ok: true,
      data: { ...base, to_account_id: fields.toAccountId, category_id: null },
    };
  }

  if (!fields.categoryId) return fail("Escolha a categoria.");
  return {
    ok: true,
    data: { ...base, to_account_id: null, category_id: fields.categoryId },
  };
}

export interface MonthSummary {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}

/**
 * Transferências e pagamento de fatura só movem dinheiro. A despesa do cartão
 * já foi contada na compra, então o pagamento não pode contar de novo.
 */
export function summarizeMonth(
  rows: { type: string; amount_cents: number }[],
): MonthSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const row of rows) {
    if (row.type === "income") incomeCents += row.amount_cents;
    if (row.type === "expense") expenseCents += row.amount_cents;
  }
  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents };
}
