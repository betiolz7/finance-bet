import { describe, expect, it } from "vitest";
import { extractPeriod, parseQuestion } from "./parse";
import { detectRecurring } from "./recurring";

const TODAY = "2026-11-11";

describe("parseQuestion", () => {
  it.each([
    ["Quanto gastei com iFood este mês?", "spent_on", "ifood"],
    ["quanto gastei no mercado", "spent_on", "mercado"],
    ["Quanto paguei de uber em outubro?", "spent_on", "uber"],
    ["gastos com a farmácia nos últimos 30 dias", "spent_on", "farmacia"],
  ])("entende gasto com algo: %s", (question, intent, term) => {
    expect(parseQuestion(question, TODAY)).toMatchObject({ intent, term });
  });

  it.each([
    ["Quanto gastei este mês?", "spent_total"],
    ["Quais foram meus maiores gastos?", "top_expenses"],
    ["Gastos por categoria no mês passado", "by_category"],
    ["Comparar com o mês passado", "compare"],
    ["Quais assinaturas eu pago?", "recurring"],
    ["Qual meu saldo?", "balance"],
    ["O que vence nos próximos dias?", "upcoming"],
    ["Como está meu orçamento?", "budget"],
    ["Como estão minhas metas?", "goals"],
    ["Quanto vai sobrar no fim do mês?", "projection"],
    ["Quanto recebi este ano?", "income"],
    ["bom dia", "unknown"],
  ])("reconhece o assunto: %s", (question, intent) => {
    expect(parseQuestion(question, TODAY).intent).toBe(intent);
  });

  it("não confunde o período com o termo", () => {
    expect(parseQuestion("quanto gastei com uber no mês passado", TODAY)).toMatchObject({
      term: "uber",
      period: { month: "2026-10" },
    });
  });
});

describe("extractPeriod", () => {
  it("usa este mês quando não há período", () => {
    expect(extractPeriod("quanto gastei", TODAY).period).toMatchObject({
      start: "2026-11-01",
      end: "2026-12-01",
      month: "2026-11",
    });
  });

  it("entende mês passado", () => {
    expect(extractPeriod("mes passado", TODAY).period.month).toBe("2026-10");
  });

  it("mês que ainda não chegou é do ano anterior", () => {
    expect(extractPeriod("em dezembro", TODAY).period.month).toBe("2025-12");
    expect(extractPeriod("em marco", TODAY).period.month).toBe("2026-03");
  });

  it("aceita mês com ano", () => {
    expect(extractPeriod("em janeiro de 2025", TODAY).period.month).toBe("2025-01");
  });

  it("entende últimos dias, incluindo hoje", () => {
    expect(extractPeriod("ultimos 7 dias", TODAY).period).toMatchObject({
      start: "2026-11-05",
      end: "2026-11-12",
    });
  });

  it("entende este ano", () => {
    expect(extractPeriod("este ano", TODAY).period).toMatchObject({
      start: "2026-01-01",
      end: "2026-11-12",
    });
  });
});

describe("detectRecurring", () => {
  const row = (description: string, date: string, cents: number) => ({
    description,
    date,
    amount_cents: cents,
  });

  it("acha gasto que se repete em três meses com valor parecido", () => {
    expect(
      detectRecurring([
        row("Netflix", "2026-08-05", 5590),
        row("NETFLIX", "2026-09-05", 5590),
        row("Netflix", "2026-10-05", 5990),
        row("Mercado", "2026-08-10", 30000),
        row("Mercado", "2026-09-10", 90000),
        row("Mercado", "2026-10-10", 15000),
        row("Cinema", "2026-10-01", 4000),
      ]),
    ).toEqual([{ description: "Netflix", averageCents: 5723, months: 3 }]);
  });

  it("ignora números da descrição, como parcelas e datas", () => {
    const result = detectRecurring([
      row("Academia 08/26", "2026-08-01", 9900),
      row("Academia 09/26", "2026-09-01", 9900),
      row("Academia 10/26", "2026-10-01", 9900),
    ]);
    expect(result).toHaveLength(1);
  });
});
