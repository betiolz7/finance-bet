import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import {
  generatedThroughOnResume,
  parseRecurringInput,
  summarizeFixedCosts,
} from "./recurring";
import { createTestDb } from "./test-db";

const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const ACCOUNT = "aaaaaaaa-0000-0000-0000-000000000001";
const CATEGORY = "cccccccc-0000-0000-0000-000000000001";
const RULE = "dddddddd-0000-0000-0000-000000000001";

let db: PGlite;
let actAs: (userId: string) => Promise<void>;

async function generate(month: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select public.generate_recurring_transactions('${month}') as n`,
  );
  return rows[0].n;
}

async function dates(): Promise<string[]> {
  const { rows } = await db.query<{ d: string }>(
    "select date::text as d from transactions order by date",
  );
  return rows.map((row) => row.d);
}

async function createRule(dueDay: number, startMonth = "2026-11-01") {
  await db.exec(`insert into recurring_rules
    (id, description, amount_cents, due_day, category_id, account_id, start_month)
    values ('${RULE}', 'Aluguel', 150000, ${dueDay}, '${CATEGORY}', '${ACCOUNT}', '${startMonth}')`);
}

beforeEach(async () => {
  ({ db, actAs } = await createTestDb([OWNER, OTHER]));
  await actAs(OWNER);
  await db.exec(`
    insert into accounts (id, name, kind) values ('${ACCOUNT}', 'Corrente', 'checking');
    insert into categories (id, name, kind) values ('${CATEGORY}', 'Moradia', 'expense');
  `);
});

describe("geração de custos fixos", () => {
  it("cria uma despesa pendente no dia do vencimento", async () => {
    await createRule(10);
    expect(await generate("2026-11-01")).toBe(1);
    const { rows } = await db.query(
      "select type, status, amount_cents::int, date::text, description from transactions",
    );
    expect(rows).toEqual([
      {
        type: "expense",
        status: "pending",
        amount_cents: 150000,
        date: "2026-11-10",
        description: "Aluguel",
      },
    ]);
  });

  it("usa o último dia quando o mês não tem o vencimento", async () => {
    await createRule(31, "2027-02-01");
    await generate("2027-02-01");
    expect(await dates()).toEqual(["2027-02-28"]);
  });

  it("não duplica ao rodar de novo", async () => {
    await createRule(10);
    await generate("2026-11-01");
    expect(await generate("2026-11-01")).toBe(0);
    expect(await dates()).toHaveLength(1);
  });

  it("recupera os meses em que o app não foi aberto", async () => {
    await createRule(10);
    await generate("2026-11-01");
    expect(await generate("2027-01-01")).toBe(2);
    expect(await dates()).toEqual(["2026-11-10", "2026-12-10", "2027-01-10"]);
  });

  it("não recria um lançamento apagado", async () => {
    await createRule(10);
    await generate("2026-11-01");
    await db.exec("delete from transactions");
    expect(await generate("2026-11-01")).toBe(0);
    expect(await dates()).toEqual([]);
  });

  it("não duplica se a data for movida para outro mês", async () => {
    await createRule(10);
    await generate("2026-11-01");
    await db.exec("update transactions set date = '2026-10-30'");
    expect(await generate("2026-11-01")).toBe(0);
    expect(await dates()).toEqual(["2026-10-30"]);
  });

  it("ajustar o valor do mês não altera a regra", async () => {
    await createRule(10);
    await generate("2026-11-01");
    await db.exec("update transactions set amount_cents = 99");
    await generate("2026-12-01");
    const { rows } = await db.query<{ amount_cents: number }>(
      "select amount_cents::int from transactions order by date",
    );
    expect(rows).toEqual([{ amount_cents: 99 }, { amount_cents: 150000 }]);
  });

  it("não gera custo pausado nem antes do primeiro mês", async () => {
    await createRule(10, "2026-12-01");
    expect(await generate("2026-11-01")).toBe(0);
    await db.exec("update recurring_rules set active = false");
    expect(await generate("2026-12-01")).toBe(0);
  });

  it("não gera os meses pausados ao reativar", async () => {
    await createRule(10);
    await generate("2026-11-01");
    await db.exec(`update recurring_rules set active = true,
      generated_through = '${generatedThroughOnResume("2026-11-01", "2027-03")}'`);
    expect(await generate("2027-03-01")).toBe(1);
    expect(await dates()).toEqual(["2026-11-10", "2027-03-10"]);
  });

  it("mantém o histórico ao apagar a regra", async () => {
    await createRule(10);
    await generate("2026-11-01");
    await db.exec("delete from recurring_rules");
    expect(await dates()).toHaveLength(1);
  });

  it("não enxerga nem gera regras de outro usuário", async () => {
    await createRule(10);
    await actAs(OTHER);
    expect(await generate("2026-11-01")).toBe(0);
    const { rows } = await db.query("select * from recurring_rules");
    expect(rows).toEqual([]);
  });
});

describe("parseRecurringInput", () => {
  const valid = {
    description: " Aluguel ",
    amount: "1.500,00",
    dueDay: "10",
    categoryId: "c",
    accountId: "a",
  };

  it("aceita um custo válido", () => {
    expect(parseRecurringInput(valid)).toEqual({
      ok: true,
      data: {
        description: "Aluguel",
        amount_cents: 150000,
        due_day: 10,
        category_id: "c",
        account_id: "a",
      },
    });
  });

  it.each(["0", "32", "1.5", "", "abc"])("rejeita o dia %j", (dueDay) => {
    expect(parseRecurringInput({ ...valid, dueDay }).ok).toBe(false);
  });

  it("rejeita valor zero", () => {
    expect(parseRecurringInput({ ...valid, amount: "0" }).ok).toBe(false);
  });
});

describe("funções auxiliares", () => {
  it("reativar parte do mês atual", () => {
    expect(generatedThroughOnResume("2026-05-01", "2026-11")).toBe("2026-10-01");
    expect(generatedThroughOnResume(null, "2026-11")).toBe("2026-10-01");
  });

  it("não volta atrás se o mês atual já foi gerado", () => {
    expect(generatedThroughOnResume("2026-11-01", "2026-11")).toBe("2026-11-01");
  });

  it("soma pago e pendente", () => {
    expect(
      summarizeFixedCosts([
        { status: "paid", amount_cents: 100 },
        { status: "pending", amount_cents: 30 },
        { status: "pending", amount_cents: 20 },
      ]),
    ).toEqual({ paidCents: 100, pendingCents: 50 });
  });
});
