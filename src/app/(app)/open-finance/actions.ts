"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describeDbError, type ActionState } from "@/lib/action-state";
import { isValidDate } from "@/lib/dates";
import {
  mapPluggyTransaction,
  parseReviewDecisions,
  type ReviewDecision,
} from "@/lib/open-finance";
import { getItem, isPluggyConfigured, listTransactions } from "@/lib/pluggy";
import { requireDb } from "@/lib/supabase/server";

export async function saveBankItem(itemId: string): Promise<ActionState> {
  const db = await requireDb();

  try {
    // Confirma que a conexão existe e pertence a estas credenciais da Pluggy.
    await getItem(itemId);
  } catch {
    return { error: "A Pluggy não confirmou esta conexão." };
  }

  const { error } = await db
    .from("bank_items")
    .upsert({ item_id: itemId }, { onConflict: "item_id", ignoreDuplicates: true });
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  return {};
}

export async function saveBankLink(
  pluggyAccountId: string,
  accountType: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const destination = String(formData.get("destination") ?? "");
  const importFrom = String(formData.get("importFrom") ?? "");

  if (!destination) {
    const { error } = await db
      .from("bank_links")
      .delete()
      .eq("pluggy_account_id", pluggyAccountId);
    if (error) return { error: describeDbError(error) };
    revalidatePath("/", "layout");
    return {};
  }

  if (!isValidDate(importFrom)) return { error: "Informe uma data válida." };

  const isCard = accountType === "CREDIT";
  const { error } = await db.from("bank_links").upsert(
    {
      pluggy_account_id: pluggyAccountId,
      account_id: isCard ? null : destination,
      card_id: isCard ? destination : null,
      import_from: importFrom,
    },
    { onConflict: "pluggy_account_id" },
  );
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  return {};
}

export async function syncBank(): Promise<ActionState> {
  const db = await requireDb();
  if (!isPluggyConfigured()) return { error: "A Pluggy não foi configurada." };

  const { data: links, error } = await db
    .from("bank_links")
    .select("id, pluggy_account_id, import_from");
  if (error) return { error: describeDbError(error) };
  if (!links || links.length === 0) {
    return { error: "Ligue ao menos uma conta antes de buscar as transações." };
  }

  try {
    for (const link of links) {
      const rows = (await listTransactions(link.pluggy_account_id, link.import_from))
        .map(mapPluggyTransaction)
        .filter((row) => row !== null);

      const { error: syncError } = await db.rpc("sync_bank_transactions", {
        p_link_id: link.id,
        p_from: link.import_from,
        p_rows: rows,
      });
      if (syncError) return { error: describeDbError(syncError) };
    }
  } catch {
    return { error: "Não foi possível falar com a Pluggy. Tente novamente." };
  }

  revalidatePath("/", "layout");
  redirect("/open-finance/revisar");
}

export async function applyReview(
  decisions: ReviewDecision[],
): Promise<ActionState> {
  const db = await requireDb();
  const parsed = parseReviewDecisions(decisions);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await db.rpc("apply_bank_review", { p_items: parsed.data });
  if (error) {
    return { error: "Não foi possível aplicar a revisão. Nada foi salvo." };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function reopenBankTransaction(id: string) {
  const db = await requireDb();
  const { error } = await db
    .from("bank_transactions")
    .update({ state: "new" })
    .eq("id", id)
    .eq("state", "ignored");
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
