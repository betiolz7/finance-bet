import { timingSafeEqual } from "node:crypto";
import { shiftMonth, todayInBrazil } from "@/lib/dates";
import { buildSummaryEmail } from "@/lib/monthly-summary";
import { collectMonthlySummary } from "@/lib/monthly-summary-server";
import { isEmailConfigured, notificationsConfig, sendEmail } from "@/lib/notifications";
import { createAdminClient, findUserIdByEmail, ownerEmail } from "@/lib/supabase/admin";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Chamado pelo agendador da Vercel no dia 1º, sem usuário logado. Por isso usa
 * a chave de serviço do Supabase, que enxerga todos os usuários. O resumo é só
 * do dono do app (NOTIFY_EMAIL_TO), filtrado pelo id dele.
 */
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return new Response(null, { status: 401 });
  }

  const db = createAdminClient();
  if (!db || !isEmailConfigured()) {
    return new Response("Resumo mensal não configurado.", { status: 503 });
  }
  const month = shiftMonth(todayInBrazil().slice(0, 7), -1);

  try {
    const ownerId = await findUserIdByEmail(db, ownerEmail());
    if (!ownerId) return new Response("Dono do app não encontrado.", { status: 503 });
    const summary = await collectMonthlySummary(db, month, ownerId);
    await sendEmail(buildSummaryEmail(summary, notificationsConfig().appUrl));
  } catch (error) {
    console.error("Falha no resumo mensal:", error);
    return new Response("Falha ao enviar o resumo.", { status: 500 });
  }
  return new Response("ok");
}
