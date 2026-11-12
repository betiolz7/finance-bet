"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { shiftMonth, todayInBrazil } from "@/lib/dates";
import { buildSummaryEmail } from "@/lib/monthly-summary";
import { collectMonthlySummary } from "@/lib/monthly-summary-server";
import {
  WEBHOOK_SECRET_HEADER,
  buildCreditEmail,
  isEmailConfigured,
  notificationsConfig,
  sendEmail,
  webhookUrl,
} from "@/lib/notifications";
import { createWebhook, listWebhooks } from "@/lib/pluggy";
import { requireDb } from "@/lib/supabase/server";

const EVENT = "transactions/created";

export async function activateNotifications(): Promise<ActionState> {
  await requireDb();
  const config = notificationsConfig();
  const url = webhookUrl(config.appUrl);

  if (!isEmailConfigured()) return { error: "Configure o e-mail antes de ativar." };
  if (!config.webhookSecret) return { error: "Falta a variável PLUGGY_WEBHOOK_SECRET." };
  if (!url) {
    return { error: "APP_URL precisa ser o endereço público do site, começando com https://." };
  }

  try {
    const existing = await listWebhooks();
    if (!existing.some((hook) => hook.url === url && hook.event === EVENT)) {
      await createWebhook({
        url,
        event: EVENT,
        headers: { [WEBHOOK_SECRET_HEADER]: config.webhookSecret },
      });
    }
  } catch {
    return { error: "A Pluggy não aceitou o cadastro do aviso. Tente novamente." };
  }

  revalidatePath("/open-finance");
  return {};
}

export async function sendMonthlySummaryNow(): Promise<ActionState> {
  const db = await requireDb();
  if (!isEmailConfigured()) return { error: "Configure o e-mail antes de enviar." };

  const month = shiftMonth(todayInBrazil().slice(0, 7), -1);
  try {
    const summary = await collectMonthlySummary(db, month);
    await sendEmail(buildSummaryEmail(summary, notificationsConfig().appUrl));
  } catch {
    return { error: "O resumo não foi enviado. Tente novamente." };
  }
  return {};
}

export async function sendTestEmail(): Promise<ActionState> {
  await requireDb();
  if (!isEmailConfigured()) return { error: "Configure o e-mail antes de testar." };

  const message = buildCreditEmail(
    "Conta de teste",
    [{ description: "Pix recebido (exemplo)", date: todayInBrazil(), cents: 12345 }],
    notificationsConfig().appUrl,
  );
  try {
    await sendEmail({ ...message, subject: `[Teste] ${message.subject}` });
  } catch {
    return { error: "O e-mail não foi enviado. Confira a chave do Resend e o destinatário." };
  }
  return {};
}
