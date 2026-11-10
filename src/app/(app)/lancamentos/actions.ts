"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describeDbError, type ActionState } from "@/lib/action-state";
import { parseCardPurchaseInput } from "@/lib/cards";
import { requireDb } from "@/lib/supabase/server";
import {
  parseTransactionInput,
  type TransactionStatus,
} from "@/lib/transactions";

function parseForm(formData: FormData) {
  const read = (key: string) => String(formData.get(key) ?? "");
  return parseTransactionInput({
    type: read("type"),
    status: read("status"),
    amount: read("amount"),
    date: read("date"),
    description: read("description"),
    accountId: read("accountId"),
    toAccountId: read("toAccountId"),
    categoryId: read("categoryId"),
  });
}

export async function createTransaction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();

  if (formData.get("type") === "card") {
    const read = (key: string) => String(formData.get(key) ?? "");
    const purchase = parseCardPurchaseInput({
      cardId: read("cardId"),
      date: read("date"),
      description: read("description"),
      amount: read("amount"),
      installments: read("installments"),
      categoryId: read("categoryId"),
    });
    if (!purchase.ok) return { error: purchase.error };

    const { error } = await db.rpc("create_card_purchase", {
      p_card_id: purchase.data.cardId,
      p_date: purchase.data.date,
      p_description: purchase.data.description,
      p_total_cents: purchase.data.totalCents,
      p_installments: purchase.data.installments,
      p_category_id: purchase.data.categoryId,
    });
    if (error) return { error: describeDbError(error) };

    revalidatePath("/", "layout");
    redirect(`/lancamentos?mes=${purchase.data.date.slice(0, 7)}`);
  }

  const parsed = parseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await db.from("transactions").insert(parsed.data);
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  redirect(`/lancamentos?mes=${parsed.data.date.slice(0, 7)}`);
}

export async function updateTransaction(
  id: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const parsed = parseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await db.from("transactions").update(parsed.data).eq("id", id);
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  redirect(`/lancamentos?mes=${parsed.data.date.slice(0, 7)}`);
}

export async function deleteTransaction(id: string) {
  const db = await requireDb();
  const { error } = await db.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function setTransactionStatus(
  id: string,
  status: TransactionStatus,
) {
  const db = await requireDb();
  const { error } = await db.from("transactions").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
