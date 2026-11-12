import { describe, expect, it } from "vitest";
import { formatCents } from "./money";
import { buildSummaryEmail, summarizeForEmail } from "./monthly-summary";

const input = {
  month: "2026-10",
  current: [
    { type: "income", amount_cents: 500000, category_id: "sal" },
    { type: "expense", amount_cents: 120000, category_id: "casa" },
    { type: "expense", amount_cents: 80000, category_id: "lazer" },
    { type: "transfer", amount_cents: 99999, category_id: null },
  ],
  previous: [{ type: "expense", amount_cents: 150000 }],
  categories: [
    { id: "sal", name: "Salário" },
    { id: "casa", name: "Moradia" },
    { id: "lazer", name: "Lazer" },
  ],
  budgets: [{ category_id: "lazer", month: "2026-09-01", limit_cents: 50000 }],
};

describe("summarizeForEmail", () => {
  const summary = summarizeForEmail(input);

  it("calcula totais sem contar transferências", () => {
    expect(summary).toMatchObject({
      incomeCents: 500000,
      expenseCents: 200000,
      balanceCents: 300000,
      savedPercent: 60,
      expenseChangeCents: 50000,
    });
  });

  it("ordena as maiores categorias e acha orçamento estourado", () => {
    expect(summary.topCategories.map((c) => c.name)).toEqual(["Moradia", "Lazer"]);
    expect(summary.overBudget).toEqual([
      { name: "Lazer", spentCents: 80000, limitCents: 50000 },
    ]);
  });

  it("monta o e-mail com assunto e link do mês", () => {
    const email = buildSummaryEmail(summary, "https://app.exemplo.com");
    expect(email.subject).toBe(`Resumo de outubro de 2026: sobraram ${formatCents(300000)}`);
    expect(email.text).toContain("https://app.exemplo.com/dashboard?mes=2026-10");
    expect(email.html).toContain("Acima do orçamento");
  });

  it("escapa nomes de categoria no HTML", () => {
    const email = buildSummaryEmail(
      { ...summary, topCategories: [{ name: "<b>x</b>", cents: 1 }] },
      "",
    );
    expect(email.html).not.toContain("<b>x</b>");
  });
});
