import { isValidDate } from "./dates";
import { parseMoneyToCents } from "./money";

export interface GoalRow {
  name: string;
  target_cents: number;
  deadline: string;
  account_id: string | null;
  investment_id: string | null;
  investment_name: string | null;
}

/**
 * `source` é "acc:<id da conta>" ou "inv:<id do investimento>". O nome do
 * investimento vem de `investmentNames`, para não confiar no formulário.
 */
export function parseGoalInput(
  fields: { name: string; target: string; deadline: string; source: string },
  investmentNames: Map<string, string> = new Map(),
): { ok: true; data: GoalRow } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });

  const name = fields.name.trim();
  if (!name) return fail("Informe o nome da meta.");

  const target = parseMoneyToCents(fields.target);
  if (target === null || target <= 0) return fail("Informe um valor válido, como 1.234,56.");

  if (!isValidDate(fields.deadline)) return fail("Informe uma data válida.");

  const base = { name, target_cents: target, deadline: fields.deadline };
  if (fields.source.startsWith("acc:") && fields.source.length > 4) {
    return {
      ok: true,
      data: { ...base, account_id: fields.source.slice(4), investment_id: null, investment_name: null },
    };
  }
  if (fields.source.startsWith("inv:") && fields.source.length > 4) {
    const id = fields.source.slice(4);
    const investmentName = investmentNames.get(id);
    if (!investmentName) return fail("Esse investimento não foi encontrado.");
    return {
      ok: true,
      data: { ...base, account_id: null, investment_id: id, investment_name: investmentName },
    };
  }
  return fail("Escolha onde o dinheiro da meta fica.");
}

/** Chave do saldo que acompanha a meta: a conta ou o investimento. */
export function goalSourceKey(goal: {
  account_id: string | null;
  investment_id?: string | null;
}): string {
  return goal.investment_id ? `inv:${goal.investment_id}` : (goal.account_id ?? "");
}

export type GoalStatus = "reached" | "overdue" | "active";

export interface GoalProgress {
  savedCents: number;
  remainingCents: number;
  percent: number;
  monthlyCents: number;
  status: GoalStatus;
  sharedAccount: boolean;
}

function monthsUntil(today: string, deadline: string): number {
  const [fromYear, fromMonth] = today.split("-").map(Number);
  const [toYear, toMonth] = deadline.split("-").map(Number);
  return Math.max(1, (toYear - fromYear) * 12 + toMonth - fromMonth);
}

/**
 * `balances` traz o saldo de cada conta pelo id e o de cada investimento pela
 * chave "inv:<id>" (veja goalSourceKey).
 */
export function goalProgress(
  goal: {
    target_cents: number;
    deadline: string;
    account_id: string | null;
    investment_id?: string | null;
  },
  balances: Map<string, number>,
  goalsByAccount: Map<string, number>,
  today: string,
): GoalProgress {
  const key = goalSourceKey(goal);
  const savedCents = Math.max(0, balances.get(key) ?? 0);
  const remainingCents = Math.max(0, goal.target_cents - savedCents);
  const reached = remainingCents === 0;

  return {
    savedCents,
    remainingCents,
    percent: Math.min(100, (savedCents / goal.target_cents) * 100),
    monthlyCents: Math.ceil(remainingCents / monthsUntil(today, goal.deadline)),
    status: reached ? "reached" : goal.deadline < today ? "overdue" : "active",
    sharedAccount: (goalsByAccount.get(key) ?? 0) > 1,
  };
}

export function countGoalsByAccount(
  goals: { account_id: string | null; investment_id?: string | null }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const goal of goals) {
    const key = goalSourceKey(goal);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
