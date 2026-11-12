import { requireDb } from "@/lib/supabase/server";
import type { CategoryOption, Option } from "./transaction-form";

const INSTITUTION = "institution_name, institution_logo, institution_color";

export async function loadActiveCards(): Promise<Option[]> {
  const db = await requireDb();
  const { data, error } = await db
    .from("credit_cards")
    .select(`id, name, ${INSTITUTION}`)
    .eq("archived", false)
    .order("name");
  if (error) throw new Error(error.message);
  return data as Option[];
}

/** Contas ativas, mantendo a conta já usada mesmo se tiver sido arquivada. */
export async function loadFormOptions(keepAccountIds: string[] = []) {
  const db = await requireDb();
  const [accounts, categories] = await Promise.all([
    db.from("accounts").select(`id, name, archived, ${INSTITUTION}`).order("name"),
    db.from("categories").select("id, name, kind, color").order("name"),
  ]);
  if (accounts.error) throw new Error(accounts.error.message);
  if (categories.error) throw new Error(categories.error.message);

  return {
    accounts: (accounts.data as (Option & { archived: boolean })[])
      .filter((a) => !a.archived || keepAccountIds.includes(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        institution_name: a.institution_name,
        institution_logo: a.institution_logo,
        institution_color: a.institution_color,
      })),
    categories: categories.data as CategoryOption[],
  };
}
