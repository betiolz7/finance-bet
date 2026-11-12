import type { SupabaseClient } from "@supabase/supabase-js";
import { connectedItemIds } from "./connected-accounts-server";
import { mapInvestments, summarizePortfolio, type Investment } from "./investments";
import { perItem } from "./per-item";
import { isPluggyConfigured, listInvestments } from "./pluggy";

export interface InvestmentsLoad {
  investments: Investment[];
  totalCents: number;
  /** true quando alguma conexão não respondeu: o total pode estar incompleto. */
  incomplete: boolean;
}

/** Investimentos de todas as conexões, sem deixar uma conexão com erro derrubar as outras. */
export async function loadInvestments(db: SupabaseClient): Promise<InvestmentsLoad> {
  if (!isPluggyConfigured()) return { investments: [], totalCents: 0, incomplete: false };
  const itemIds = await connectedItemIds(db);
  const { results, failed } = await perItem(itemIds, listInvestments);
  const investments = mapInvestments(results.flatMap(({ value }) => value));
  return {
    investments,
    totalCents: summarizePortfolio(investments).totalCents,
    incomplete: failed.length > 0,
  };
}

/** Chave usada para achar o saldo de um investimento junto com o das contas. */
export function investmentKey(id: string): string {
  return `inv:${id}`;
}
