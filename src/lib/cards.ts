import { isCardStyle } from "./card-style";
import { isValidDate } from "./dates";
import { parseMoneyToCents } from "./money";

export const MAX_INSTALLMENTS = 48;

function validDay(value: string): number | null {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

export interface CardRow {
  name: string;
  limit_cents: number;
  closing_day: number;
  due_day: number;
  payment_account_id: string;
  color: string | null;
  style: string | null;
  last_digits: string | null;
}

export function parseCardInput(fields: {
  name: string;
  limit: string;
  closingDay: string;
  dueDay: string;
  accountId: string;
  color?: string;
  style?: string;
  lastDigits?: string;
}): { ok: true; data: CardRow } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });

  const name = fields.name.trim();
  if (!name) return fail("Informe o nome do cartão.");

  const limit = parseMoneyToCents(fields.limit.trim() || "0");
  if (limit === null || limit < 0) return fail("Informe um limite válido.");

  const closingDay = validDay(fields.closingDay);
  if (closingDay === null) return fail("O dia de fechamento precisa estar entre 1 e 31.");

  const dueDay = validDay(fields.dueDay);
  if (dueDay === null) return fail("O dia de vencimento precisa estar entre 1 e 31.");

  if (!fields.accountId) return fail("Escolha a conta de pagamento.");

  const color = fields.color?.trim().toLowerCase() || null;
  if (color && !/^#[0-9a-f]{6}$/.test(color)) return fail("Escolha uma cor válida.");

  const style = fields.style?.trim() || null;
  if (style && !isCardStyle(style)) return fail("Escolha um visual válido.");

  const lastDigits = fields.lastDigits?.trim() || null;
  if (lastDigits && !/^[0-9]{4}$/.test(lastDigits)) {
    return fail("Informe apenas os 4 últimos dígitos do cartão.");
  }

  return {
    ok: true,
    data: {
      name,
      limit_cents: limit,
      closing_day: closingDay,
      due_day: dueDay,
      payment_account_id: fields.accountId,
      color,
      style,
      last_digits: lastDigits,
    },
  };
}

export interface CardPurchase {
  cardId: string;
  date: string;
  description: string;
  totalCents: number;
  installments: number;
  categoryId: string;
}

export function parseCardPurchaseInput(fields: {
  cardId: string;
  date: string;
  description: string;
  amount: string;
  installments: string;
  categoryId: string;
}): { ok: true; data: CardPurchase } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });

  const totalCents = parseMoneyToCents(fields.amount);
  if (totalCents === null) return fail("Informe um valor válido, como 1.234,56.");
  if (totalCents <= 0) return fail("O valor precisa ser maior que zero.");

  if (!isValidDate(fields.date)) return fail("Informe uma data válida.");

  const description = fields.description.trim();
  if (!description) return fail("Informe uma descrição.");
  if (!fields.cardId) return fail("Escolha o cartão.");
  if (!fields.categoryId) return fail("Escolha a categoria.");

  const installments = Number(fields.installments);
  if (
    !Number.isInteger(installments) ||
    installments < 1 ||
    installments > MAX_INSTALLMENTS
  ) {
    return fail(`As parcelas precisam estar entre 1 e ${MAX_INSTALLMENTS}.`);
  }
  if (totalCents < installments) {
    return fail("O valor é pequeno demais para essa quantidade de parcelas.");
  }

  return {
    ok: true,
    data: {
      cardId: fields.cardId,
      date: fields.date,
      description,
      totalCents,
      installments,
      categoryId: fields.categoryId,
    },
  };
}

export type InvoiceStatus = "paid" | "closed" | "open";

export function invoiceStatus(
  invoice: { paid_at: string | null; closing_date: string },
  today: string,
): InvoiceStatus {
  if (invoice.paid_at) return "paid";
  return today >= invoice.closing_date ? "closed" : "open";
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: "Paga",
  closed: "Fechada",
  open: "Aberta",
};

export interface InvoiceTotal {
  paid_at: string | null;
  due_date: string;
  total_cents: number;
}

/** Parcelas futuras ocupam o limite até a fatura delas ser paga. */
export function usedLimitCents(invoices: InvoiceTotal[]): number {
  return invoices
    .filter((invoice) => !invoice.paid_at)
    .reduce((sum, invoice) => sum + invoice.total_cents, 0);
}

/** A fatura em aberto com o vencimento mais próximo e algum valor. */
export function nextInvoiceToPay<T extends InvoiceTotal>(
  invoices: T[],
): T | undefined {
  return invoices
    .filter((invoice) => !invoice.paid_at && invoice.total_cents > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
}
