"use server";

import { revalidatePath } from "next/cache";
import { describeDbError, type ActionState } from "@/lib/action-state";
import { requireDb } from "@/lib/supabase/server";

const DEFAULT_CATEGORIES = [
  { name: "Salário", kind: "income", color: "#3a7320" },
  { name: "Renda extra", kind: "income", color: "#9bcf53" },
  { name: "Moradia", kind: "expense", color: "#f2a65a" },
  { name: "Alimentação", kind: "expense", color: "#e4572e" },
  { name: "Transporte", kind: "expense", color: "#4d7ea8" },
  { name: "Saúde", kind: "expense", color: "#2a9d8f" },
  { name: "Lazer", kind: "expense", color: "#9b5de5" },
  { name: "Educação", kind: "expense", color: "#577590" },
  { name: "Assinaturas", kind: "expense", color: "#b5838d" },
  { name: "Imprevistos", kind: "expense", color: "#d4a200" },
];

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

export async function createDefaultCategories() {
  const db = await requireDb();
  const { error } = await db.from("categories").insert(DEFAULT_CATEGORIES);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
