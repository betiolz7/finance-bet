import { describe, expect, it } from "vitest";
import { projectMonthEnd } from "./dashboard";
import { countGoalsByAccount, goalProgress, parseGoalInput } from "./goals";
import { createTestDb } from "./test-db";

describe("goalProgress", () => {
  const goal = { target_cents: 100000, deadline: "2027-02-15", account_id: "a" };
  const today = "2026-11-10";
  const progress = (balance: number, change = {}) =>
    goalProgress(
      { ...goal, ...change },
      new Map([["a", balance]]),
      new Map([["a", 1]]),
      today,
    );

  it("usa o saldo da conta como valor guardado", () => {
    expect(progress(25000)).toMatchObject({
      savedCents: 25000,
      remainingCents: 75000,
      percent: 25,
      status: "active",
    });
  });

  it("divide o que falta pelos meses até o prazo", () => {
    expect(progress(25000).monthlyCents).toBe(25000);
  });

  it("arredonda a parcela para cima, para alcançar o valor", () => {
    expect(progress(99999, { deadline: "2027-02-15" }).monthlyCents).toBe(1);
  });

  it("no mês do prazo, pede tudo o que falta", () => {
    expect(progress(0, { deadline: "2026-11-30" }).monthlyCents).toBe(100000);
  });

  it("marca meta alcançada, sem passar de 100%", () => {
    expect(progress(150000)).toMatchObject({
      status: "reached",
      remainingCents: 0,
      percent: 100,
      monthlyCents: 0,
    });
  });

  it("marca prazo vencido", () => {
    expect(progress(0, { deadline: "2026-11-09" }).status).toBe("overdue");
  });

  it("alcançada não fica vencida", () => {
    expect(progress(100000, { deadline: "2026-01-01" }).status).toBe("reached");
  });

  it("saldo negativo conta como zero", () => {
    expect(progress(-500).savedCents).toBe(0);
  });

  it("avisa quando duas metas usam a mesma conta", () => {
    const counts = countGoalsByAccount([{ account_id: "a" }, { account_id: "a" }]);
    expect(goalProgress(goal, new Map(), counts, today).sharedAccount).toBe(true);
  });
});

describe("parseGoalInput", () => {
  const valid = { name: " Viagem ", target: "4.000,00", deadline: "2027-07-01", accountId: "a" };

  it("aceita uma meta válida", () => {
    expect(parseGoalInput(valid)).toEqual({
      ok: true,
      data: {
        name: "Viagem",
        target_cents: 400000,
        deadline: "2027-07-01",
        account_id: "a",
      },
    });
  });

  it.each([
    ["sem nome", { name: " " }],
    ["valor zero", { target: "0" }],
    ["data inválida", { deadline: "2027-02-30" }],
    ["sem conta", { accountId: "" }],
  ])("recusa %s", (_label, change) => {
    expect(parseGoalInput({ ...valid, ...change }).ok).toBe(false);
  });
});

describe("projectMonthEnd", () => {
  it("soma receitas pendentes e desconta contas e faturas", () => {
    expect(
      projectMonthEnd(
        100000,
        [
          { type: "income", amount_cents: 50000 },
          { type: "expense", amount_cents: 20000 },
        ],
        [{ total_cents: 30000 }],
      ),
    ).toEqual({
      balanceCents: 100000,
      pendingIncomeCents: 50000,
      pendingExpenseCents: 20000,
      invoicesCents: 30000,
      projectedCents: 100000,
    });
  });

  it("pode terminar negativo", () => {
    expect(
      projectMonthEnd(1000, [{ type: "expense", amount_cents: 5000 }], []).projectedCents,
    ).toBe(-4000);
  });
});

describe("tabela de metas", () => {
  const OWNER = "11111111-1111-1111-1111-111111111111";
  const OTHER = "22222222-2222-2222-2222-222222222222";
  const ACCOUNT = "aaaaaaaa-0000-0000-0000-000000000001";

  it("isola outros usuários e protege a conta vinculada", async () => {
    const { db, actAs } = await createTestDb([OWNER, OTHER]);
    await actAs(OWNER);
    await db.exec(`
      insert into accounts (id, name, kind) values ('${ACCOUNT}', 'Reserva', 'savings');
      insert into goals (name, target_cents, deadline, account_id)
        values ('Viagem', 100, '2027-07-01', '${ACCOUNT}');
    `);
    await expect(db.exec("delete from accounts")).rejects.toThrow(/foreign key/);

    await actAs(OTHER);
    expect((await db.query("select * from goals")).rows).toEqual([]);
  });
});
