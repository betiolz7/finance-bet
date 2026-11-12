import type { SupabaseClient } from "@supabase/supabase-js";
import type { BudgetRow } from "./dashboard";
import { monthBounds, shiftMonth } from "./dates";
import { summarizeForEmail, type MonthlySummary } from "./monthly-summary";

/** Junta os dados do mês para o resumo. Funciona com a sessão do usuário ou com a chave de serviço. */
export async function collectMonthlySummary(
  db: SupabaseClient,
  month: string,
): Promise<MonthlySummary> {
  const current = monthBounds(month);
  const previous = monthBounds(shiftMonth(month, -1));

  const [now, before, categories, budgets] = await Promise.all([
    db
      .from("transactions")
      .select("type, amount_cents, category_id")
      .in("type", ["income", "expense"])
      .gte("date", current.start)
      .lt("date", current.end),
    db
      .from("transactions")
      .select("type, amount_cents")
      .in("type", ["income", "expense"])
      .gte("date", previous.start)
      .lt("date", previous.end),
    db.from("categories").select("id, name"),
    db.from("budgets").select("category_id, month, limit_cents").lte("month", current.start),
  ]);
  for (const result of [now, before, categories, budgets]) {
    if (result.error) throw new Error(result.error.message);
  }

  return summarizeForEmail({
    month,
    current: now.data ?? [],
    previous: before.data ?? [],
    categories: categories.data ?? [],
    budgets: (budgets.data ?? []) as BudgetRow[],
  });
}
