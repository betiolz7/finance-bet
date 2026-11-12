"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describeDbError, type ActionState } from "@/lib/action-state";
import {
  connectedItemIds,
  ensureConnectedAccounts,
} from "@/lib/connected-accounts-server";
import { normalizeColor, safeLogoUrl } from "@/lib/connected-accounts";
import { isValidDate } from "@/lib/dates";
import {
  mapPluggyTransaction,
  parseReviewDecisions,
  type ReviewDecision,
} from "@/lib/open-finance";
import {
  getConnector,
  getItem,
  isPluggyConfigured,
  listTransactions,
} from "@/lib/pluggy";
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

  try {
    await ensureConnectedAccounts(db);
  } catch {
    return { error: "Conexão salva, mas não foi possível importar as contas agora." };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function refreshConnectedAccounts(): Promise<ActionState> {
  const db = await requireDb();
  if (!isPluggyConfigured()) return { error: "A Pluggy não foi configurada." };

  try {
    const { skipped } = await ensureConnectedAccounts(db);
    revalidatePath("/", "layout");
    if (skipped > 0) {
      return {
        error:
          "Cartões sem uma conta bancária conectada ficaram de fora. Conecte a conta do banco e tente de novo.",
      };
    }
    return {};
  } catch {
    return { error: "Não foi possível importar as contas. Tente novamente." };
  }
}

export async function setItemBank(
  itemId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const connectorId = Number(formData.get("connectorId"));
  if (!Number.isInteger(connectorId) || connectorId <= 0) {
    return { error: "Escolha o banco." };
  }

  const itemIds = await connectedItemIds(db);
  if (!itemIds.includes(itemId)) return { error: "Conexão não encontrada." };

  let connector;
  try {
    connector = await getConnector(connectorId);
  } catch {
    return { error: "Não foi possível buscar este banco na Pluggy." };
  }

  const { error } = await db.rpc("set_item_institution", {
    p_item_id: itemId,
    p_connector_id: connector.id,
    p_name: connector.name,
    p_logo: safeLogoUrl(connector.imageUrl),
    p_color: normalizeColor(connector.primaryColor),
  });
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  return {};
}

/** Desde quando trazer as transações de uma conta. O saldo vem do banco, então não conta em dobro. */
export async function setImportFrom(
  linkId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const db = await requireDb();
  const date = String(formData.get("importFrom") ?? "");
  if (!isValidDate(date)) return { error: "Informe uma data válida." };

  const { error } = await db.from("bank_links").update({ import_from: date }).eq("id", linkId);
  if (error) return { error: describeDbError(error) };

  revalidatePath("/open-finance");
  return {};
}

export async function syncBank(): Promise<ActionState> {
  const db = await requireDb();
  if (!isPluggyConfigured()) return { error: "A Pluggy não foi configurada." };

  try {
    await ensureConnectedAccounts(db);
  } catch {
    return { error: "Não foi possível falar com a Pluggy. Tente novamente." };
  }

  const { data: links, error } = await db
    .from("bank_links")
    .select("id, pluggy_account_id, import_from");
  if (error) return { error: describeDbError(error) };
  if (!links || links.length === 0) {
    return { error: "Nenhuma conta conectada ainda." };
  }

  // Uma conta com problema não impede a busca das outras.
  let failed = 0;
  for (const link of links) {
    let rows;
    try {
      rows = (await listTransactions(link.pluggy_account_id, link.import_from))
        .map(mapPluggyTransaction)
        .filter((row) => row !== null);
    } catch {
      failed++;
      continue;
    }

    const { error: syncError } = await db.rpc("sync_bank_transactions", {
      p_link_id: link.id,
      p_from: link.import_from,
      p_rows: rows,
    });
    if (syncError) return { error: describeDbError(syncError) };
  }

  if (failed === links.length) {
    return { error: "Não foi possível falar com a Pluggy. Tente novamente." };
  }

  revalidatePath("/", "layout");
  redirect(`/open-finance/revisar${failed > 0 ? `?falhas=${failed}` : ""}`);
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
