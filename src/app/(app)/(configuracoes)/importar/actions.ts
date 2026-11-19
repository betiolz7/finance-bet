"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describeDbError, type ActionState } from "@/lib/action-state";
import { parseImportPayload, type ImportPayload } from "@/lib/import";
import { requireDb } from "@/lib/supabase/server";

export async function confirmImport(
  payload: ImportPayload,
): Promise<ActionState> {
  const db = await requireDb();
  const parsed = parseImportPayload(payload);
  if (!parsed.ok) return { error: parsed.error };

  const { fileName, date, accountId, cardId, lines } = parsed.data;
  const { error } = cardId
    ? await db.rpc("import_card_expenses", {
        p_file_name: fileName,
        p_date: date,
        p_card_id: cardId,
        p_lines: lines,
      })
    : await db.rpc("import_expenses", {
        p_file_name: fileName,
        p_date: date,
        p_account_id: accountId,
        p_lines: lines,
      });
  if (error) return { error: describeDbError(error) };

  revalidatePath("/", "layout");
  redirect(`/lancamentos?mes=${date.slice(0, 7)}`);
}

export async function undoImport(id: string) {
  const db = await requireDb();
  const { error } = await db.from("imports").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
