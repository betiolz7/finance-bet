"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describeDbError, type ActionState } from "@/lib/action-state";
import { parseGoalInput } from "@/lib/goals";
import { loadInvestments } from "@/lib/investments-server";
import { requireDb } from "@/lib/supabase/server";

async function parseForm(db: SupabaseClient, formData: FormData) {
  const read = (key: string) => String(formData.get(key) ?? "");
  const source = read("source");
  // O nome do investimento vem da Pluggy, não do formulário.
  const names = source.startsWith("inv:")
    ? new Map((await loadInvestments(db)).investments.map((i) => [i.id, i.name]))
    : new Map<string, string>();
  return parseGoalInput(
    { name: read("name"), target: read("target"), deadline: read("deadline"), source },
    names,
  );
}

export async function createGoal(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const parsed = await parseForm(db, formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await db.from("goals").insert(parsed.data);
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  return {};
}

export async function updateGoal(
  id: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const parsed = await parseForm(db, formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await db.from("goals").update(parsed.data).eq("id", id);
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  redirect("/metas");
}

export async function deleteGoal(id: string) {
  const db = await requireDb();
  const { error } = await db.from("goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
