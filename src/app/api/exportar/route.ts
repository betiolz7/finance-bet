import writeExcelFile from "write-excel-file/node";
import { isValidMonth, monthBounds } from "@/lib/dates";
import {
  EXPORT_COLUMNS,
  buildExportRows,
  buildSheet,
  type ExportTransaction,
} from "@/lib/export";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const TYPES_BY_TAB: Record<string, string[]> = {
  receitas: ["income"],
  despesas: ["expense"],
  transferencias: ["transfer", "invoice_payment"],
};

/** Baixa os lançamentos do mês em Excel. Aceita ?mes=AAAA-MM e ?tipo=receitas|despesas|transferencias. */
export async function GET(request: Request) {
  if (!isSupabaseConfigured) return new Response(null, { status: 503 });
  const db = await createClient();
  const { data: auth } = await db.auth.getClaims();
  if (!auth?.claims) return new Response(null, { status: 401 });

  const url = new URL(request.url);
  const month = url.searchParams.get("mes") ?? "";
  if (!isValidMonth(month)) return new Response("Mês inválido.", { status: 400 });
  const tab = url.searchParams.get("tipo") ?? "";
  const { start, end } = monthBounds(month);

  let query = db
    .from("transactions")
    .select(
      `date, description, type, status, amount_cents,
       category:categories(name),
       account:accounts!transactions_account_id_fkey(name),
       to_account:accounts!transactions_to_account_id_fkey(name),
       invoice:invoices(card:credit_cards(name))`,
    )
    .gte("date", start)
    .lt("date", end)
    .order("date")
    .order("created_at");
  if (TYPES_BY_TAB[tab]) query = query.in("type", TYPES_BY_TAB[tab]);

  const { data, error } = await query;
  if (error) return new Response("Não foi possível exportar.", { status: 500 });

  const sheet = buildSheet(buildExportRows(data as unknown as ExportTransaction[]));
  const buffer = await writeExcelFile(sheet, { columns: EXPORT_COLUMNS }).toBuffer();

  const suffix = TYPES_BY_TAB[tab] ? `-${tab}` : "";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lancamentos-${month}${suffix}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
