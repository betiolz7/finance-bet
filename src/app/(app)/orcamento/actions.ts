"use server";

import { revalidatePath } from "next/cache";
import { describeDbError, type ActionState } from "@/lib/action-state";
import { isValidMonth } from "@/lib/dates";
import { parseMoneyToCents } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";

export async function saveBudget(
  categoryId: string,
  month: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  if (!isValidMonth(month)) return { error: "Mês inválido." };

  const text = String(formData.get("limit") ?? "").trim() || "0";
  const cents = parseMoneyToCents(text);
  if (cents === null || cents < 0) {
    return { error: "Informe um valor válido, como 1.234,56." };
  }

  const { error } = await db
    .from("budgets")
    .upsert(
      { category_id: categoryId, month: `${month}-01`, limit_cents: cents },
      { onConflict: "category_id,month" },
    );
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  return {};
}
