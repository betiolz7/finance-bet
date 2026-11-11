import { addDays, isValidDate, todayInBrazil } from "./dates";
import { parseMoneyToCents } from "./money";
import type { PluggyAccount } from "./pluggy";

export interface ConnectedAccountPlan {
  p_item_id: string;
  p_pluggy_account_id: string;
  p_type: "BANK" | "CREDIT";
  p_name: string;
  p_balance_cents: number;
  p_limit_cents: number;
  p_closing_day: number;
  p_due_day: number;
  p_last_digits: string | null;
  p_import_from: string;
}

const DEFAULT_CLOSING_DAY = 1;
const DEFAULT_DUE_DAY = 10;

function dayOf(value?: string | null): number | null {
  const date = value?.slice(0, 10);
  return date && isValidDate(date) ? Number(date.slice(8, 10)) : null;
}

/**
 * Como a conta nasce com o saldo informado pelo banco, as transações só contam
 * a partir do dia seguinte à última atualização, para não contar duas vezes.
 * No cartão, busca desde o último fechamento, que é a fatura em aberto.
 */
export function planConnectedAccount(
  account: PluggyAccount,
  itemLastUpdatedAt: string | null | undefined,
  today: string,
): ConnectedAccountPlan {
  const isCard = account.type === "CREDIT";
  const name = (account.marketingName || account.name || "Conta").trim();
  const lastUpdated = itemLastUpdatedAt
    ? todayInBrazil(new Date(itemLastUpdatedAt))
    : null;
  const closeDate = account.creditData?.balanceCloseDate?.slice(0, 10);

  const importFrom = isCard
    ? closeDate && isValidDate(closeDate) && closeDate <= today
      ? closeDate
      : `${today.slice(0, 7)}-01`
    : lastUpdated && lastUpdated <= today
      ? addDays(lastUpdated, 1)
      : today;

  const digits = account.number?.replace(/\D/g, "").slice(-4);

  return {
    p_item_id: account.itemId,
    p_pluggy_account_id: account.id,
    p_type: isCard ? "CREDIT" : "BANK",
    p_name: name,
    p_balance_cents: isCard ? 0 : (parseMoneyToCents(account.balance ?? 0) ?? 0),
    p_limit_cents: Math.max(
      0,
      parseMoneyToCents(account.creditData?.creditLimit ?? 0) ?? 0,
    ),
    p_closing_day: dayOf(account.creditData?.balanceCloseDate) ?? DEFAULT_CLOSING_DAY,
    p_due_day: dayOf(account.creditData?.balanceDueDate) ?? DEFAULT_DUE_DAY,
    p_last_digits: isCard && digits && digits.length === 4 ? digits : null,
    p_import_from: importFrom,
  };
}

/** Contas antes de cartões: o cartão precisa de uma conta para a fatura. */
export function orderForCreation<T extends { type: string }>(accounts: T[]): T[] {
  return [...accounts].sort(
    (a, b) => Number(a.type === "CREDIT") - Number(b.type === "CREDIT"),
  );
}

/** Aceita só cor hexadecimal, com ou sem #, como a Pluggy devolve. */
export function normalizeColor(value?: string | null): string | null {
  const hex = value?.trim().replace(/^#/, "").toLowerCase();
  return hex && /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null;
}

/** Só ícones hospedados pela Pluggy entram na página. */
export function safeLogoUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "cdn.pluggy.ai" ? url.href : null;
  } catch {
    return null;
  }
}
