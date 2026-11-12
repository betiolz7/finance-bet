"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describeDbError, type ActionState } from "@/lib/action-state";
import { institutionFromForm } from "@/lib/institution-server";
import { parseMoneyToCents } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";

const KINDS = ["checking", "savings", "cash", "investment"];

function parseForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const balance = String(formData.get("initialBalance") ?? "").trim() || "0";
  const cents = parseMoneyToCents(balance);

  if (!name) return { error: "Informe o nome da conta." };
  if (!KINDS.includes(kind)) return { error: "Escolha o tipo da conta." };
  if (cents === null) return { error: "Informe um saldo válido, como 1.234,56." };
  return { data: { name, kind, initial_balance_cents: cents } };
}

export async function updateAccount(
  id: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const parsed = parseForm(formData);
  if (!parsed.data) return { error: parsed.error };

  const institution = await institutionFromForm(formData);
  if (institution.error) return { error: institution.error };

  const { error } = await db
    .from("accounts")
    .update({ ...parsed.data, ...institution.fields })
    .eq("id", id);
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  redirect("/contas");
}

export async function setAccountArchived(id: string, archived: boolean) {
  const db = await requireDb();
  const { error } = await db.from("accounts").update({ archived }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
