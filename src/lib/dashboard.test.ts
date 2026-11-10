import { describe, expect, it } from "vitest";
import {
  budgetLevel,
  dailySeries,
  effectiveBudgets,
  percentChange,
  spendingByCategory,
  upcomingBills,
} from "./dashboard";
import { addDays } from "./dates";
import { createTestDb } from "./test-db";

describe("effectiveBudgets", () => {
  const rows = [
    { category_id: "a", month: "2026-09-01", limit_cents: 100 },
    { category_id: "a", month: "2026-11-01", limit_cents: 200 },
    { category_id: "b", month: "2026-10-01", limit_cents: 300 },
    { category_id: "b", month: "2026-11-01", limit_cents: 0 },
  ];

  it("repete o limite nos meses seguintes", () => {
    expect(effectiveBudgets(rows, "2026-10").get("a")).toBe(100);
  });

  it("usa a alteração mais recente", () => {
    expect(effectiveBudgets(rows, "2027-02").get("a")).toBe(200);
  });

  it("não aplica limite antes de ele existir", () => {
    expect(effectiveBudgets(rows, "2026-08").size).toBe(0);
  });

  it("zero remove o orçamento daquele mês em diante", () => {
    expect(effectiveBudgets(rows, "2026-10").get("b")).toBe(300);
    expect(effectiveBudgets(rows, "2026-11").has("b")).toBe(false);
  });
});

describe("spendingByCategory", () => {
  it("soma só despesas, incluindo as pendentes e de cartão", () => {
    const totals = spendingByCategory([
      { type: "expense", category_id: "a", amount_cents: 100 },
      { type: "expense", category_id: "a", amount_cents: 50 },
      { type: "income", category_id: "s", amount_cents: 999 },
      { type: "invoice_payment", category_id: null, amount_cents: 999 },
      { type: "transfer", category_id: null, amount_cents: 999 },
    ]);
    expect([...totals]).toEqual([["a", 150]]);
  });
});

describe("budgetLevel", () => {
  it.each([
    [79, "ok"],
    [80, "warning"],
    [100, "warning"],
    [101, "over"],
  ])("gasto %i de 100 é %s", (spent, level) => {
    expect(budgetLevel(spent, 100)).toBe(level);
  });
});

describe("upcomingBills", () => {
  const pending = [
    { id: "1", description: "Luz", date: "2026-11-05", amount_cents: 100 },
    { id: "2", description: "Longe", date: "2027-02-01", amount_cents: 100 },
  ];
  const invoices = [
    { id: "a", card_id: "c", due_date: "2026-11-28", total_cents: 500 },
    { id: "b", card_id: "c", due_date: "2026-11-20", total_cents: 0 },
  ];
  const bills = upcomingBills(
    pending,
    invoices,
    new Map([["c", "Nubank"]]),
    "2026-11-10",
    addDays("2026-11-10", 30),
  );

  it("ignora o que vence depois do limite e fatura zerada", () => {
    expect(bills.map((bill) => bill.label)).toEqual(["Luz", "Fatura Nubank"]);
  });

  it("marca o que já venceu", () => {
    expect(bills.map((bill) => bill.overdue)).toEqual([true, false]);
  });
});

describe("dailySeries", () => {
  it("soma por dia, mantém dias vazios e ignora transferências", () => {
    expect(
      dailySeries(
        [
          { type: "income", amount_cents: 100, date: "2026-11-09" },
          { type: "expense", amount_cents: 30, date: "2026-11-09" },
          { type: "expense", amount_cents: 20, date: "2026-11-09" },
          { type: "transfer", amount_cents: 999, date: "2026-11-09" },
          { type: "expense", amount_cents: 999, date: "2026-11-01" },
        ],
        ["2026-11-09", "2026-11-10"],
      ),
    ).toEqual([
      { date: "2026-11-09", incomeCents: 100, expenseCents: 50 },
      { date: "2026-11-10", incomeCents: 0, expenseCents: 0 },
    ]);
  });
});

describe("percentChange", () => {
  it("calcula a variação e evita divisão por zero", () => {
    expect(percentChange(115, 100)).toBeCloseTo(15);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(50, 0)).toBeNull();
  });
});

describe("addDays", () => {
  it("atravessa a virada do ano", () => {
    expect(addDays("2026-12-20", 30)).toBe("2027-01-19");
  });
});

describe("tabela de orçamentos", () => {
  const OWNER = "11111111-1111-1111-1111-111111111111";
  const OTHER = "22222222-2222-2222-2222-222222222222";
  const CATEGORY = "cccccccc-0000-0000-0000-000000000001";

  it("atualiza o mesmo mês e isola outros usuários", async () => {
    const { db, actAs } = await createTestDb([OWNER, OTHER]);
    await actAs(OWNER);
    await db.exec(`
      insert into categories (id, name, kind) values ('${CATEGORY}', 'Lazer', 'expense');
      insert into budgets (category_id, month, limit_cents)
        values ('${CATEGORY}', '2026-11-01', 100)
        on conflict (category_id, month) do update set limit_cents = excluded.limit_cents;
      insert into budgets (category_id, month, limit_cents)
        values ('${CATEGORY}', '2026-11-01', 200)
        on conflict (category_id, month) do update set limit_cents = excluded.limit_cents;
    `);
    const { rows } = await db.query("select limit_cents::int from budgets");
    expect(rows).toEqual([{ limit_cents: 200 }]);

    await actAs(OTHER);
    expect((await db.query("select * from budgets")).rows).toEqual([]);
  });
});
