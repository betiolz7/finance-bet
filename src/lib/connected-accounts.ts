import { isValidDate } from "./dates";
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
 * O saldo exibido de uma conta conectada é o informado pelo banco, então dá
 * para trazer o histórico do mês sem contar nada em dobro. No cartão, busca
 * desde o último fechamento, que é a fatura em aberto.
 */
export function planConnectedAccount(
  account: PluggyAccount,
  _itemLastUpdatedAt: string | null | undefined,
  today: string,
): ConnectedAccountPlan {
  const isCard = account.type === "CREDIT";
  const name = (account.marketingName || account.name || "Conta").trim();
  const closeDate = account.creditData?.balanceCloseDate?.slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;

  const importFrom = isCard
    ? closeDate && isValidDate(closeDate) && closeDate <= today
      ? closeDate
      : monthStart
    : monthStart;

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

/** Saldos informados pelo banco, em centavos, só das contas (não cartões). */
export function bankBalances(
  accounts: PluggyAccount[],
): { pluggy_account_id: string; balance_cents: number }[] {
  return accounts
    .filter((account) => account.type !== "CREDIT" && typeof account.balance === "number")
    .map((account) => ({
      pluggy_account_id: account.id,
      balance_cents: parseMoneyToCents(account.balance as number) ?? 0,
    }));
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
