"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describeDbError, type ActionState } from "@/lib/action-state";
import { institutionFromForm } from "@/lib/institution-server";
import { parseCardInput } from "@/lib/cards";
import { isValidDate } from "@/lib/dates";
import { parseMoneyToCents } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";

function parseCardForm(formData: FormData) {
  const read = (key: string) => String(formData.get(key) ?? "");
  // O campo "visual" vem como "style:<modelo>", "color:<hex>" ou vazio.
  const look = read("look");
  return parseCardInput({
    name: read("name"),
    limit: read("limit"),
    closingDay: read("closingDay"),
    dueDay: read("dueDay"),
    accountId: read("accountId"),
    color: look.startsWith("color:") ? look.slice(6) : "",
    style: look.startsWith("style:") ? look.slice(6) : "",
    lastDigits: read("lastDigits"),
  });
}

export async function updateCard(
  id: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const parsed = parseCardForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const institution = await institutionFromForm(formData);
  if (institution.error) return { error: institution.error };

  const { error } = await db
    .from("credit_cards")
    .update({ ...parsed.data, ...institution.fields })
    .eq("id", id);
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  redirect("/cartoes");
}

export async function setCardArchived(id: string, archived: boolean) {
  const db = await requireDb();
  const { error } = await db.from("credit_cards").update({ archived }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function payInvoice(
  id: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const cents = parseMoneyToCents(String(formData.get("amount") ?? ""));
  const date = String(formData.get("date") ?? "");
  const accountId = String(formData.get("accountId") ?? "");

  if (cents === null || cents <= 0) return { error: "Informe um valor válido." };
  if (!isValidDate(date)) return { error: "Informe uma data válida." };
  if (!accountId) return { error: "Escolha a conta." };

  const { error } = await db.rpc("pay_invoice", {
    p_invoice_id: id,
    p_account_id: accountId,
    p_date: date,
    p_amount_cents: cents,
  });
  if (error) return { error: "Não foi possível pagar. A fatura já pode estar paga." };

  revalidatePath("/", "layout");
  return {};
}

export async function unpayInvoice(id: string) {
  const db = await requireDb();
  const { error } = await db.rpc("unpay_invoice", { p_invoice_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function moveCardTransaction(
  id: string,
  months: number,
): Promise<ActionState> {
  const db = await requireDb();
  const { error } = await db.rpc("move_card_transaction", {
    p_transaction_id: id,
    p_months: months,
  });
  if (error) return { error: "Não é possível mover para uma fatura já paga." };

  revalidatePath("/", "layout");
  return {};
}

/** Compras em fatura já paga só mudam depois de desfazer o pagamento. */
async function isInOpenInvoice(db: SupabaseClient, id: string): Promise<boolean> {
  const { data } = await db
    .from("transactions")
    .select("type, invoice:invoices(paid_at)")
    .eq("id", id)
    .maybeSingle();
  const invoice = data?.invoice as unknown as { paid_at: string | null } | null;
  return data?.type === "expense" && invoice !== null && invoice?.paid_at === null;
}

export async function updateCardTransaction(
  id: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const cents = parseMoneyToCents(String(formData.get("amount") ?? ""));

  if (!description) return { error: "Informe uma descrição." };
  if (!categoryId) return { error: "Escolha a categoria." };
  if (cents === null || cents <= 0) return { error: "Informe um valor válido." };
  if (!(await isInOpenInvoice(db, id))) {
    return { error: "Esta compra está em uma fatura já paga." };
  }

  const { data, error } = await db
    .from("transactions")
    .update({ description, category_id: categoryId, amount_cents: cents })
    .eq("id", id)
    .select("invoice_id")
    .single();
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  redirect(`/faturas/${data.invoice_id}`);
}

export async function deleteCardTransaction(id: string) {
  const db = await requireDb();
  if (!(await isInOpenInvoice(db, id))) {
    throw new Error("Esta compra está em uma fatura já paga.");
  }
  const { error } = await db.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function deleteCardPurchase(groupId: string) {
  const db = await requireDb();
  const { error } = await db.rpc("delete_card_purchase", { p_group_id: groupId });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
