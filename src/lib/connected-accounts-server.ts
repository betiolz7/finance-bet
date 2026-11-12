import type { SupabaseClient } from "@supabase/supabase-js";
import { orderForCreation, planConnectedAccount } from "./connected-accounts";
import { todayInBrazil } from "./dates";
import { perItem } from "./per-item";
import { getItem, listAccounts, pluggyItemIds } from "./pluggy";

export async function connectedItemIds(db: SupabaseClient): Promise<string[]> {
  const { data, error } = await db.from("bank_items").select("item_id");
  if (error) throw new Error(error.message);
  return [
    ...new Set([
      ...pluggyItemIds(),
      ...(data as { item_id: string }[]).map((row) => row.item_id),
    ]),
  ];
}

/**
 * Cria no app as contas e cartões que ainda não existem. Pode ser repetido.
 * Conexões que não respondem são puladas e contadas em `failed`.
 */
export async function ensureConnectedAccounts(
  db: SupabaseClient,
): Promise<{ created: number; skipped: number; failed: number }> {
  const today = todayInBrazil();
  const itemIds = await connectedItemIds(db);
  const { results, failed } = await perItem(itemIds, async (itemId) => {
    const [item, accounts] = await Promise.all([getItem(itemId), listAccounts(itemId)]);
    return { lastUpdatedAt: item.lastUpdatedAt, accounts };
  });

  const lastUpdated = new Map(results.map(({ itemId, value }) => [itemId, value.lastUpdatedAt]));
  const accounts = orderForCreation(results.flatMap(({ value }) => value.accounts));

  let created = 0;
  let skipped = 0;
  for (const account of accounts) {
    const plan = planConnectedAccount(account, lastUpdated.get(account.itemId), today);
    const { data, error } = await db.rpc("connect_pluggy_account", plan);
    if (error) throw new Error(error.message);
    if (data === "created") created++;
    if (data === "skipped") skipped++;
  }
  return { created, skipped, failed: failed.length };
}
