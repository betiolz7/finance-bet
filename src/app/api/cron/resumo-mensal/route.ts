import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { shiftMonth, todayInBrazil } from "@/lib/dates";
import { buildSummaryEmail } from "@/lib/monthly-summary";
import { collectMonthlySummary } from "@/lib/monthly-summary-server";
import { isEmailConfigured, notificationsConfig, sendEmail } from "@/lib/notifications";
import { supabaseUrl } from "@/lib/supabase/config";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Chamado pelo agendador da Vercel no dia 1º, sem usuário logado. Por isso usa
 * a chave de serviço do Supabase, que fica só no servidor. O app tem um único
 * usuário; com vários, seria preciso separar os dados por usuário aqui.
 */
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return new Response(null, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!serviceKey || !supabaseUrl || !isEmailConfigured()) {
    return new Response("Resumo mensal não configurado.", { status: 503 });
  }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const month = shiftMonth(todayInBrazil().slice(0, 7), -1);

  try {
    const summary = await collectMonthlySummary(db, month);
    await sendEmail(buildSummaryEmail(summary, notificationsConfig().appUrl));
  } catch (error) {
    console.error("Falha no resumo mensal:", error);
    return new Response("Falha ao enviar o resumo.", { status: 500 });
  }
  return new Response("ok");
}
