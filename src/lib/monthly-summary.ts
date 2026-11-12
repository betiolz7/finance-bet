import { budgetLevel, effectiveBudgets, spendingByCategory, type BudgetRow } from "./dashboard";
import { formatMonth } from "./dates";
import { formatCents } from "./money";
import { summarizeMonth } from "./transactions";

export interface SummaryInput {
  month: string;
  current: { type: string; amount_cents: number; category_id: string | null }[];
  previous: { type: string; amount_cents: number }[];
  categories: { id: string; name: string }[];
  budgets: BudgetRow[];
}

export interface MonthlySummary {
  month: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  savedPercent: number | null;
  expenseChangeCents: number;
  topCategories: { name: string; cents: number }[];
  overBudget: { name: string; spentCents: number; limitCents: number }[];
}

export function summarizeForEmail(input: SummaryInput): MonthlySummary {
  const now = summarizeMonth(input.current);
  const before = summarizeMonth(input.previous);
  const names = new Map(input.categories.map((c) => [c.id, c.name]));
  const spending = spendingByCategory(input.current);
  const limits = effectiveBudgets(input.budgets, input.month);

  return {
    month: input.month,
    incomeCents: now.incomeCents,
    expenseCents: now.expenseCents,
    balanceCents: now.balanceCents,
    savedPercent:
      now.incomeCents > 0 ? Math.round((now.balanceCents / now.incomeCents) * 100) : null,
    expenseChangeCents: now.expenseCents - before.expenseCents,
    topCategories: [...spending.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, cents]) => ({ name: names.get(id) ?? "Sem categoria", cents })),
    overBudget: [...limits.entries()]
      .map(([id, limit]) => ({
        name: names.get(id) ?? "Sem categoria",
        spentCents: spending.get(id) ?? 0,
        limitCents: limit,
      }))
      .filter((item) => budgetLevel(item.spentCents, item.limitCents) === "over"),
  };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildSummaryEmail(summary: MonthlySummary, appUrl: string) {
  const label = formatMonth(summary.month);
  const subject = `Resumo de ${label}: sobraram ${formatCents(summary.balanceCents)}`;
  const change =
    summary.expenseChangeCents === 0
      ? "Gastos iguais ao mês anterior."
      : `Gastos ${formatCents(Math.abs(summary.expenseChangeCents))} ${
          summary.expenseChangeCents > 0 ? "acima" : "abaixo"
        } do mês anterior.`;
  const saved =
    summary.savedPercent === null ? "" : ` (${summary.savedPercent}% das receitas)`;
  const dashboard = appUrl ? `${appUrl}/dashboard?mes=${summary.month}` : "";

  const text = [
    `Resumo de ${label}`,
    "",
    `Receitas: ${formatCents(summary.incomeCents)}`,
    `Despesas: ${formatCents(summary.expenseCents)}`,
    `Sobra: ${formatCents(summary.balanceCents)}${saved}`,
    change,
    "",
    "Maiores gastos:",
    ...summary.topCategories.map((c) => `- ${c.name}: ${formatCents(c.cents)}`),
    ...(summary.overBudget.length
      ? ["", "Acima do orçamento:", ...summary.overBudget.map(
          (b) => `- ${b.name}: ${formatCents(b.spentCents)} de ${formatCents(b.limitCents)}`,
        )]
      : []),
    dashboard ? `\nVer no app: ${dashboard}` : "",
  ].join("\n");

  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 16px 4px 0;color:#63676b">${label}</td>` +
    `<td style="padding:4px 0;text-align:right;${strong ? "font-weight:700" : ""}">${value}</td></tr>`;

  const html =
    `<div style="font-family:Arial,sans-serif;color:#141414;max-width:520px">` +
    `<h2 style="font-size:20px;margin:0 0 12px">Resumo de ${escapeHtml(label)}</h2>` +
    `<table style="border-collapse:collapse;font-size:15px">` +
    row("Receitas", formatCents(summary.incomeCents)) +
    row("Despesas", formatCents(summary.expenseCents)) +
    row("Sobra", `${formatCents(summary.balanceCents)}${saved}`, true) +
    `</table>` +
    `<p style="font-size:14px;color:#63676b">${escapeHtml(change)}</p>` +
    (summary.topCategories.length
      ? `<h3 style="font-size:15px;margin:16px 0 6px">Maiores gastos</h3><table style="border-collapse:collapse;font-size:14px">` +
        summary.topCategories.map((c) => row(escapeHtml(c.name), formatCents(c.cents))).join("") +
        `</table>`
      : "") +
    (summary.overBudget.length
      ? `<h3 style="font-size:15px;margin:16px 0 6px;color:#a84c15">Acima do orçamento</h3><table style="border-collapse:collapse;font-size:14px">` +
        summary.overBudget
          .map((b) => row(escapeHtml(b.name), `${formatCents(b.spentCents)} de ${formatCents(b.limitCents)}`))
          .join("") +
        `</table>`
      : "") +
    (dashboard
      ? `<p style="margin-top:16px"><a href="${dashboard}" style="color:#2f6d1a">Ver o mês no finance-bet</a></p>`
      : "") +
    `</div>`;

  return { subject, text, html };
}
