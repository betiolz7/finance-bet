import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import {
  normalizeColor,
  orderForCreation,
  planConnectedAccount,
  safeLogoUrl,
} from "./connected-accounts";
import type { PluggyAccount } from "./pluggy";
import { createTestDb } from "./test-db";

const bank: PluggyAccount = {
  id: "p-bank",
  itemId: "item-1",
  type: "BANK",
  name: "Conta corrente",
  marketingName: "Conta Digital Inter",
  balance: 1234.56,
};

const card: PluggyAccount = {
  id: "p-card",
  itemId: "item-1",
  type: "CREDIT",
  name: "Cartão",
  marketingName: "Inter Black",
  number: "**** 4821",
  creditData: {
    balanceCloseDate: "2026-11-03",
    balanceDueDate: "2026-11-10T00:00:00.000Z",
    creditLimit: 5000,
  },
};

describe("planConnectedAccount", () => {
  it("conta nasce com o saldo do banco e busca a partir do dia seguinte", () => {
    expect(planConnectedAccount(bank, "2026-11-10T12:00:00.000Z", "2026-11-11")).toMatchObject({
      p_type: "BANK",
      p_name: "Conta Digital Inter",
      p_balance_cents: 123456,
      p_import_from: "2026-11-11",
    });
  });

  it("usa a data do Brasil para a última atualização", () => {
    expect(
      planConnectedAccount(bank, "2026-11-11T01:30:00.000Z", "2026-11-11").p_import_from,
    ).toBe("2026-11-11");
  });

  it("sem atualização conhecida, começa hoje", () => {
    expect(planConnectedAccount(bank, null, "2026-11-11").p_import_from).toBe("2026-11-11");
  });

  it("cartão usa dias, limite e final do cartão vindos do banco", () => {
    expect(planConnectedAccount(card, null, "2026-11-11")).toMatchObject({
      p_type: "CREDIT",
      p_name: "Inter Black",
      p_balance_cents: 0,
      p_limit_cents: 500000,
      p_closing_day: 3,
      p_due_day: 10,
      p_last_digits: "4821",
      p_import_from: "2026-11-03",
    });
  });

  it("cartão sem datas usa padrões e o início do mês", () => {
    expect(
      planConnectedAccount({ ...card, creditData: null, number: null }, null, "2026-11-11"),
    ).toMatchObject({
      p_closing_day: 1,
      p_due_day: 10,
      p_last_digits: null,
      p_import_from: "2026-11-01",
    });
  });

  it("cria contas antes dos cartões", () => {
    expect(orderForCreation([card, bank]).map((a) => a.type)).toEqual(["BANK", "CREDIT"]);
  });
});

describe("dados da Pluggy", () => {
  it("normaliza a cor", () => {
    expect(normalizeColor("EC7000")).toBe("#ec7000");
    expect(normalizeColor("#ff7a00")).toBe("#ff7a00");
    expect(normalizeColor("vermelho")).toBeNull();
  });

  it("só aceita ícone da Pluggy por https", () => {
    expect(safeLogoUrl("https://cdn.pluggy.ai/assets/connector-icons/201.svg")).toBe(
      "https://cdn.pluggy.ai/assets/connector-icons/201.svg",
    );
    expect(safeLogoUrl("http://cdn.pluggy.ai/x.svg")).toBeNull();
    expect(safeLogoUrl("https://exemplo.com/x.svg")).toBeNull();
    expect(safeLogoUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("funções do banco de dados", () => {
  const OWNER = "11111111-1111-1111-1111-111111111111";
  const OTHER = "22222222-2222-2222-2222-222222222222";
  let db: PGlite;
  let actAs: (userId: string) => Promise<void>;

  async function connect(plan: ReturnType<typeof planConnectedAccount>) {
    const { rows } = await db.query<{ r: string }>(
      `select public.connect_pluggy_account($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as r`,
      [
        plan.p_item_id,
        plan.p_pluggy_account_id,
        plan.p_type,
        plan.p_name,
        plan.p_balance_cents,
        plan.p_limit_cents,
        plan.p_closing_day,
        plan.p_due_day,
        plan.p_last_digits,
        plan.p_import_from,
      ],
    );
    return rows[0].r;
  }

  beforeEach(async () => {
    ({ db, actAs } = await createTestDb([OWNER, OTHER]));
    await actAs(OWNER);
  });

  it("cria a conta com o saldo do banco, uma vez só", async () => {
    const plan = planConnectedAccount(bank, null, "2026-11-11");
    expect(await connect(plan)).toBe("created");
    expect(await connect(plan)).toBe("existing");
    const { rows } = await db.query(
      "select name, balance_cents::int as balance from account_balances",
    );
    expect(rows).toEqual([{ name: "Conta Digital Inter", balance: 123456 }]);
  });

  it("cartão sem nenhuma conta para pagar fica de fora", async () => {
    expect(await connect(planConnectedAccount(card, null, "2026-11-11"))).toBe("skipped");
    expect((await db.query("select * from credit_cards")).rows).toEqual([]);
  });

  it("cartão usa a conta do mesmo banco para pagar a fatura", async () => {
    await connect(planConnectedAccount(bank, null, "2026-11-11"));
    await connect(planConnectedAccount(card, null, "2026-11-11"));
    const { rows } = await db.query(`
      select c.name, c.last_digits, a.name as payment
      from credit_cards c join accounts a on a.id = c.payment_account_id`);
    expect(rows).toEqual([
      { name: "Inter Black", last_digits: "4821", payment: "Conta Digital Inter" },
    ]);
  });

  it("o banco escolhido vale para contas, cartões e conexões futuras", async () => {
    await connect(planConnectedAccount(bank, null, "2026-11-11"));
    await db.exec(
      "select public.set_item_institution('item-1', 201, 'Inter', 'https://cdn.pluggy.ai/i.svg', '#ff7a00')",
    );
    await connect(planConnectedAccount(card, null, "2026-11-11"));
    const accounts = await db.query("select institution_name from accounts");
    const cards = await db.query("select institution_name from credit_cards");
    expect(accounts.rows).toEqual([{ institution_name: "Inter" }]);
    expect(cards.rows).toEqual([{ institution_name: "Inter" }]);
  });

  it("vínculo antigo ganha o id da conexão sem duplicar a conta", async () => {
    await db.exec(`
      insert into accounts (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Manual', 'checking');
      insert into bank_links (pluggy_account_id, account_id, import_from)
        values ('p-bank', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-11-01');
    `);
    expect(await connect(planConnectedAccount(bank, null, "2026-11-11"))).toBe("existing");
    const { rows } = await db.query("select item_id from bank_links");
    expect(rows).toEqual([{ item_id: "item-1" }]);
    expect((await db.query("select * from accounts")).rows).toHaveLength(1);
  });

  it("outro usuário não vê as contas criadas", async () => {
    await connect(planConnectedAccount(bank, null, "2026-11-11"));
    await actAs(OTHER);
    expect((await db.query("select * from accounts")).rows).toEqual([]);
  });
});
