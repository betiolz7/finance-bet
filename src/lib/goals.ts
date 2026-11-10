import { isValidDate } from "./dates";
import { parseMoneyToCents } from "./money";

export interface GoalRow {
  name: string;
  target_cents: number;
  deadline: string;
  account_id: string;
}

export function parseGoalInput(fields: {
  name: string;
  target: string;
  deadline: string;
  accountId: string;
}): { ok: true; data: GoalRow } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });

  const name = fields.name.trim();
  if (!name) return fail("Informe o nome da meta.");

  const target = parseMoneyToCents(fields.target);
  if (target === null || target <= 0) return fail("Informe um valor válido, como 1.234,56.");

  if (!isValidDate(fields.deadline)) return fail("Informe uma data válida.");
  if (!fields.accountId) return fail("Escolha a conta da meta.");

  return {
    ok: true,
    data: {
      name,
      target_cents: target,
      deadline: fields.deadline,
      account_id: fields.accountId,
    },
  };
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

export function goalProgress(
  goal: { target_cents: number; deadline: string; account_id: string },
  balances: Map<string, number>,
  goalsByAccount: Map<string, number>,
  today: string,
): GoalProgress {
  const savedCents = Math.max(0, balances.get(goal.account_id) ?? 0);
  const remainingCents = Math.max(0, goal.target_cents - savedCents);
  const reached = remainingCents === 0;

  return {
    savedCents,
    remainingCents,
    percent: Math.min(100, (savedCents / goal.target_cents) * 100),
    monthlyCents: Math.ceil(remainingCents / monthsUntil(today, goal.deadline)),
    status: reached ? "reached" : goal.deadline < today ? "overdue" : "active",
    sharedAccount: (goalsByAccount.get(goal.account_id) ?? 0) > 1,
  };
}

export function countGoalsByAccount(
  goals: { account_id: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const goal of goals) {
    counts.set(goal.account_id, (counts.get(goal.account_id) ?? 0) + 1);
  }
  return counts;
}
