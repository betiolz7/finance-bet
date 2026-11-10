import { cache } from "react";
import { requireDb } from "./supabase/server";

/** Dados do menu e da barra superior, buscados uma vez por requisição. */
export const loadShellData = cache(async () => {
  const db = await requireDb();
  const [claims, review] = await Promise.all([
    db.auth.getClaims(),
    db
      .from("bank_transactions")
      .select("id", { count: "exact", head: true })
      .eq("state", "new"),
  ]);
  const email = String(claims.data?.claims?.email ?? "");
  return { email, reviewCount: review.count ?? 0 };
});
