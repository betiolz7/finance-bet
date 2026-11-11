import { timingSafeEqual } from "node:crypto";
import { formatDate } from "./dates";
import { formatCents, parseMoneyToCents } from "./money";
import type { PluggyTransaction } from "./pluggy";
import { WEBHOOK_PATH } from "./webhook-path";

export function webhookUrl(appUrl: string): string | null {
  return appUrl.startsWith("https://") ? `${appUrl}${WEBHOOK_PATH}` : null;
}

export { WEBHOOK_PATH, WEBHOOK_SECRET_HEADER } from "./webhook-path";

export function notificationsConfig() {
  return {
    resendKey: process.env.RESEND_API_KEY ?? "",
    to: process.env.NOTIFY_EMAIL_TO ?? "",
    from: process.env.NOTIFY_EMAIL_FROM || "finance-bet <onboarding@resend.dev>",
    webhookSecret: process.env.PLUGGY_WEBHOOK_SECRET ?? "",
    appUrl: (process.env.APP_URL ?? "").replace(/\/+$/, ""),
  };
}

export function isEmailConfigured(): boolean {
  const config = notificationsConfig();
  return Boolean(config.resendKey && config.to);
}

/** Compara a senha do webhook sem vazar, pelo tempo de resposta, onde ela difere. */
export function isValidWebhookSecret(received: string | null, expected: string): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface Credit {
  description: string;
  date: string;
  cents: number;
}

/** Só entradas: CREDIT com valor, e sem as que chegaram antes do aviso. */
export function creditsFrom(
  transactions: PluggyTransaction[],
  createdAtFrom?: string | null,
): Credit[] {
  return transactions
    .filter((t) => t.type === "CREDIT")
    .filter((t) => !createdAtFrom || !t.createdAt || t.createdAt >= createdAtFrom)
    .map((t) => ({
      description: t.description.trim() || "Sem descrição",
      date: t.date.slice(0, 10),
      cents: Math.abs(parseMoneyToCents(t.amountInAccountCurrency ?? t.amount) ?? 0),
    }))
    .filter((credit) => credit.cents > 0);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildCreditEmail(accountName: string, credits: Credit[], appUrl: string) {
  const total = credits.reduce((sum, credit) => sum + credit.cents, 0);
  const subject =
    credits.length === 1
      ? `Entrada de ${formatCents(total)} em ${accountName}`
      : `${credits.length} entradas somando ${formatCents(total)} em ${accountName}`;

  const lines = credits.map(
    (credit) => `${formatDate(credit.date)} · ${credit.description} · ${formatCents(credit.cents)}`,
  );
  const reviewUrl = appUrl ? `${appUrl}/open-finance/revisar` : "";

  const text = [
    `Chegou dinheiro em ${accountName}:`,
    "",
    ...lines,
    "",
    `Total: ${formatCents(total)}`,
    reviewUrl ? `Revise no app: ${reviewUrl}` : "",
  ].join("\n");

  const rows = credits
    .map(
      (credit) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#63676b">${formatDate(credit.date)}</td>` +
        `<td style="padding:6px 12px 6px 0">${escapeHtml(credit.description)}</td>` +
        `<td style="padding:6px 0;text-align:right;font-weight:600">${formatCents(credit.cents)}</td></tr>`,
    )
    .join("");

  const html =
    `<div style="font-family:Arial,sans-serif;color:#141414;max-width:520px">` +
    `<p style="font-size:16px">Chegou dinheiro em <strong>${escapeHtml(accountName)}</strong>:</p>` +
    `<table style="border-collapse:collapse;font-size:14px;width:100%">${rows}</table>` +
    `<p style="font-size:16px;margin-top:16px">Total: <strong>${formatCents(total)}</strong></p>` +
    (reviewUrl
      ? `<p><a href="${escapeHtml(reviewUrl)}" style="color:#2f6d1a">Revisar no finance-bet</a></p>`
      : "") +
    `<p style="font-size:12px;color:#63676b">Os dados chegam pelo Open Finance, uma vez por dia.</p>` +
    `</div>`;

  return { subject, text, html };
}

export async function sendEmail(message: { subject: string; text: string; html: string }) {
  const config = notificationsConfig();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: config.from, to: [config.to], ...message }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`O Resend recusou o e-mail (status ${response.status}).`);
  }
}
