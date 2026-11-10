"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describeDbError, type ActionState } from "@/lib/action-state";
import { todayInBrazil } from "@/lib/dates";
import {
  generatedThroughOnResume,
  monthToDate,
  parseRecurringInput,
} from "@/lib/recurring";
import { requireDb } from "@/lib/supabase/server";

function parseForm(formData: FormData) {
  const read = (key: string) => String(formData.get(key) ?? "");
  return parseRecurringInput({
    description: read("description"),
    amount: read("amount"),
    dueDay: read("dueDay"),
    categoryId: read("categoryId"),
    accountId: read("accountId"),
  });
}

export async function createRecurringRule(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const parsed = parseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const startMonth = monthToDate(String(formData.get("startMonth") ?? ""));
  if (!startMonth) return { error: "Escolha o primeiro mês." };

  const { error } = await db
    .from("recurring_rules")
    .insert({ ...parsed.data, start_month: startMonth });
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  redirect("/custos-fixos");
}

export async function updateRecurringRule(
  id: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const parsed = parseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await db
    .from("recurring_rules")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  redirect("/custos-fixos");
}

export async function pauseRecurringRule(id: string) {
  const db = await requireDb();
  const { error } = await db
    .from("recurring_rules")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function resumeRecurringRule(id: string) {
  const db = await requireDb();
  const { data, error: readError } = await db
    .from("recurring_rules")
    .select("generated_through")
    .eq("id", id)
    .single();
  if (readError) throw new Error(readError.message);

  const { error } = await db
    .from("recurring_rules")
    .update({
      active: true,
      generated_through: generatedThroughOnResume(
        data.generated_through,
        todayInBrazil().slice(0, 7),
      ),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function deleteRecurringRule(id: string) {
  const db = await requireDb();
  const { error } = await db.from("recurring_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
