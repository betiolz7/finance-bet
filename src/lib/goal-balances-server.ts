import type { SupabaseClient } from "@supabase/supabase-js";
import type { Investment } from "./investments";
import { investmentKey, loadInvestments } from "./investments-server";

/**
 * Saldos que alimentam as metas: contas pelo id e investimentos por
 * "inv:<id>". Só consulta a Pluggy quando alguma meta usa investimento.
 */
export async function loadGoalBalances(
  db: SupabaseClient,
  options: { withInvestments: boolean },
): Promise<{ balances: Map<string, number>; investments: Investment[] }> {
  const [accounts, investments] = await Promise.all([
    db.from("account_balances").select("id, balance_cents"),
    options.withInvestments
      ? loadInvestments(db).then((load) => load.investments)
      : Promise.resolve([] as Investment[]),
  ]);
  if (accounts.error) throw new Error(accounts.error.message);

  const balances = new Map<string, number>(
    (accounts.data as { id: string; balance_cents: number }[]).map((row) => [
      row.id,
      row.balance_cents,
    ]),
  );
  for (const investment of investments) {
    balances.set(investmentKey(investment.id), investment.balanceCents);
  }
  return { balances, investments };
}
