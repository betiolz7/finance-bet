"use server";

import { revalidatePath } from "next/cache";
import { describeDbError, type ActionState } from "@/lib/action-state";
import { parseRuleInput } from "@/lib/category-rules";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { requireDb } from "@/lib/supabase/server";

function readColor(formData: FormData): string {
  const color = String(formData.get("color") ?? "");
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#9bcf53";
}

export async function createCategory(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  if (!name) return { error: "Informe o nome da categoria." };
  if (kind !== "income" && kind !== "expense") {
    return { error: "Escolha o tipo da categoria." };
  }

  const { error } = await db
    .from("categories")
    .insert({ name, kind, color: readColor(formData) });
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  return {};
}

export async function updateCategory(
  id: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome da categoria." };

  const { error } = await db
    .from("categories")
    .update({ name, color: readColor(formData) })
    .eq("id", id);
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  return {};
}

export async function deleteCategory(id: string): Promise<ActionState> {
  const db = await requireDb();
  const { error } = await db.from("categories").delete().eq("id", id);
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  return {};
}

export async function createRule(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const parsed = parseRuleInput({
    pattern: String(formData.get("pattern") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await db.from("category_rules").insert(parsed.data);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Já existe uma regra com esse texto."
          : describeDbError(error),
    };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function deleteRule(id: string) {
  const db = await requireDb();
  const { error } = await db.from("category_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function createDefaultCategories() {
  const db = await requireDb();
  const { error } = await db.from("categories").insert(DEFAULT_CATEGORIES);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
