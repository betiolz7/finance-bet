import { cache } from "react";
import { todayInBrazil } from "./dates";
import { requireDb } from "./supabase/server";

/** Garante que os custos fixos até o mês atual já viraram lançamentos. */
export const ensureRecurringGenerated = cache(async () => {
  const db = await requireDb();
  const { error } = await db.rpc("generate_recurring_transactions", {
    p_month: `${todayInBrazil().slice(0, 7)}-01`,
  });
  if (error) throw new Error(error.message);
});
