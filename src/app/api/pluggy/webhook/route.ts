import { after } from "next/server";
import {
  WEBHOOK_SECRET_HEADER,
  buildCreditEmail,
  creditsFrom,
  isEmailConfigured,
  isValidWebhookSecret,
  notificationsConfig,
  sendEmail,
} from "@/lib/notifications";
import { getAccount, listTransactions } from "@/lib/pluggy";

interface WebhookPayload {
  event?: string;
  clientId?: string;
  accountId?: string;
  transactionsCreatedAtFrom?: string;
  transactionsMinDate?: string;
}

/**
 * Recebe os avisos da Pluggy. Responde na hora, porque a Pluggy só espera
 * 10 segundos, e só depois busca as entradas novas e manda o e-mail.
 */
export async function POST(request: Request) {
  const config = notificationsConfig();
  if (!isValidWebhookSecret(request.headers.get(WEBHOOK_SECRET_HEADER), config.webhookSecret)) {
    return new Response(null, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return new Response(null, { status: 400 });
  }

  const ownClientId = process.env.PLUGGY_CLIENT_ID;
  if (payload.clientId && ownClientId && payload.clientId !== ownClientId) {
    return new Response(null, { status: 200 });
  }
  if (payload.event !== "transactions/created" || !payload.accountId || !isEmailConfigured()) {
    return new Response(null, { status: 200 });
  }

  const { accountId, transactionsCreatedAtFrom, transactionsMinDate } = payload;
  after(async () => {
    try {
      // Os dados vêm direto da Pluggy, e não do corpo do aviso.
      const account = await getAccount(accountId);
      if (account.type !== "BANK") return;

      const dateFrom =
        transactionsMinDate?.slice(0, 10) ??
        new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const credits = creditsFrom(
        await listTransactions(accountId, dateFrom, transactionsCreatedAtFrom),
        transactionsCreatedAtFrom,
      );
      if (credits.length === 0) return;

      const name = (account.marketingName || account.name || "sua conta").trim();
      await sendEmail(buildCreditEmail(name, credits, config.appUrl));
    } catch (error) {
      console.error("Falha ao enviar aviso de entrada:", error);
    }
  });

  return new Response(null, { status: 200 });
}
