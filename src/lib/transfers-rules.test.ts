import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { categoryFromRules, parseRuleInput } from "./category-rules";
import { buildReviewItems, pairTransfers, parseReviewDecisions, type ReviewInput } from "./open-finance";
import { createTestDb } from "./test-db";

const base: ReviewInput = {
  id: "d1",
  description: "PIX ENVIADO",
  amount_cents: 50000,
  direction: "debit",
  date: "2026-11-10",
  pluggy_status: "POSTED",
  category: null,
  linkName: "Inter",
  accountId: "inter",
  cardId: null,
};

describe("pairTransfers", () => {
  it("junta saída e entrada de mesmo valor em contas diferentes", () => {
    const credit = { ...base, id: "c1", direction: "credit" as const, accountId: "xp", linkName: "XP" };
    expect(pairTransfers([base, credit]).get("d1")?.id).toBe("c1");
  });

  it.each([
    ["mesma conta", { accountId: "inter" }],
    ["valor diferente", { amount_cents: 49999 }],
    ["mais de 2 dias depois", { date: "2026-11-13" }],
    ["entrada no cartão", { accountId: null, cardId: "card" }],
  ])("não junta com %s", (_label, change) => {
    const credit = { ...base, id: "c1", direction: "credit" as const, accountId: "xp", ...change };
    expect(pairTransfers([base, credit]).size).toBe(0);
  });

  it("usa cada entrada uma vez só", () => {
    const credit = { ...base, id: "c1", direction: "credit" as const, accountId: "xp" };
    const pairs = pairTransfers([base, { ...base, id: "d2" }, credit]);
    expect(pairs.size).toBe(1);
  });

  it("sugere transferência na saída e deixa a entrada junto com ela", () => {
    const credit = { ...base, id: "c1", direction: "credit" as const, accountId: "xp", linkName: "XP" };
    const items = buildReviewItems([base, credit], { pending: [], paidHistory: [], categories: [] });
    expect(items.map((item) => item.defaultChoice)).toEqual(["transfer:c1", "ignore"]);
    expect(items[0].transferTo).toEqual({ id: "c1", accountName: "XP" });
  });

  it("converte a escolha de transferência", () => {
    expect(parseReviewDecisions([{ id: "d1", choice: "transfer:c1", categoryId: "" }])).toEqual({
      ok: true,
      data: [{ id: "d1", action: "transfer", pair_id: "c1" }],
    });
  });
});

describe("regras automáticas", () => {
  const rules = [
    { pattern: "uber", category_id: "transporte" },
    { pattern: "Uber Eats", category_id: "alimentacao" },
    { pattern: "farmácia", category_id: "saude" },
  ];

  it("a regra mais específica vence", () => {
    expect(categoryFromRules("UBER EATS *PEDIDO", rules)).toBe("alimentacao");
    expect(categoryFromRules("UBER *TRIP", rules)).toBe("transporte");
  });

  it("ignora acentos e maiúsculas", () => {
    expect(categoryFromRules("FARMACIA SAO JOAO", rules)).toBe("saude");
  });

  it("respeita o tipo permitido", () => {
    expect(categoryFromRules("UBER", rules, (id) => id !== "transporte")).toBeNull();
  });

  it("regra vence o histórico na revisão do banco", () => {
    const items = buildReviewItems([{ ...base, description: "UBER *TRIP" }], {
      pending: [],
      paidHistory: [{ description: "UBER *TRIP", category_id: "outra", amount_cents: 1, date: "2026-01-01" }],
      categories: [
        { id: "transporte", name: "Transporte", kind: "expense" },
        { id: "outra", name: "Outra", kind: "expense" },
      ],
      rules,
    });
    expect(items[0].defaultCategoryId).toBe("transporte");
  });

  it.each([
    ["texto curto", { pattern: "a", categoryId: "c" }],
    ["sem categoria", { pattern: "uber", categoryId: "" }],
  ])("recusa %s", (_label, input) => {
    expect(parseRuleInput(input).ok).toBe(false);
  });
});

describe("transferência no banco de dados", () => {
  const OWNER = "11111111-1111-1111-1111-111111111111";
  const INTER = "aaaaaaaa-0000-0000-0000-000000000001";
  const XP = "aaaaaaaa-0000-0000-0000-000000000002";
  let db: PGlite;

  async function bankId(pluggyId: string) {
    const { rows } = await db.query<{ id: string }>(
      "select id from bank_transactions where pluggy_id = $1",
      [pluggyId],
    );
    return rows[0].id;
  }

  beforeEach(async () => {
    const test = await createTestDb([OWNER]);
    db = test.db;
    await test.actAs(OWNER);
    await db.exec(`
      insert into accounts (id, name, kind) values ('${INTER}', 'Inter', 'checking'), ('${XP}', 'XP', 'checking');
      insert into bank_links (id, pluggy_account_id, account_id, import_from) values
        ('bbbbbbbb-0000-0000-0000-000000000001', 'p-inter', '${INTER}', '2026-11-01'),
        ('bbbbbbbb-0000-0000-0000-000000000002', 'p-xp', '${XP}', '2026-11-01');
      select public.sync_bank_transactions('bbbbbbbb-0000-0000-0000-000000000001', '2026-11-01',
        '[{"pluggy_id":"out","description":"PIX ENVIADO","amount_cents":50000,"direction":"debit","date":"2026-11-10"}]');
      select public.sync_bank_transactions('bbbbbbbb-0000-0000-0000-000000000002', '2026-11-01',
        '[{"pluggy_id":"in","description":"PIX RECEBIDO","amount_cents":50000,"direction":"credit","date":"2026-11-10"}]');
    `);
  });

  it("cria uma transferência só e consome as duas linhas", async () => {
    const out = await bankId("out");
    const incoming = await bankId("in");
    await db.query("select public.apply_bank_review($1)", [
      JSON.stringify([
        { id: incoming, action: "ignore" },
        { id: out, action: "transfer", pair_id: incoming },
      ]),
    ]);

    const tx = await db.query("select type, amount_cents::int as cents from transactions");
    expect(tx.rows).toEqual([{ type: "transfer", cents: 50000 }]);
    const states = await db.query("select state from bank_transactions order by pluggy_id");
    expect(states.rows).toEqual([{ state: "imported" }, { state: "imported" }]);
    const balances = await db.query(
      "select name, balance_cents::int as b from account_balances order by name",
    );
    expect(balances.rows).toEqual([
      { name: "Inter", b: -50000 },
      { name: "XP", b: 50000 },
    ]);
  });

  it("recusa transferência com par inválido", async () => {
    const out = await bankId("out");
    await expect(
      db.query("select public.apply_bank_review($1)", [
        JSON.stringify([{ id: out, action: "transfer", pair_id: out }]),
      ]),
    ).rejects.toThrow(/transfer pair/);
  });
});
