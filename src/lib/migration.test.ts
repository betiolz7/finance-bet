import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./test-db";

const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

let db: PGlite;
let actAs: (userId: string) => Promise<void>;

beforeAll(async () => {
  ({ db, actAs } = await createTestDb([OWNER, OTHER]));

  await actAs(OWNER);
  await db.exec(`
    insert into accounts (id, name, kind, initial_balance_cents) values
      ('aaaaaaaa-0000-0000-0000-000000000001', 'Corrente', 'checking', 100000),
      ('aaaaaaaa-0000-0000-0000-000000000002', 'Investimentos', 'investment', 0);
    insert into categories (id, name, kind) values
      ('cccccccc-0000-0000-0000-000000000001', 'Salário', 'income'),
      ('cccccccc-0000-0000-0000-000000000002', 'Mercado', 'expense');
    insert into transactions (type, status, amount_cents, date, description, account_id, category_id, to_account_id) values
      ('income', 'paid', 500000, '2026-11-05', 'Salário', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', null),
      ('expense', 'paid', 20000, '2026-11-06', 'Compras', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', null),
      ('expense', 'pending', 99900, '2026-11-20', 'Ainda não paga', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', null),
      ('transfer', 'paid', 30000, '2026-11-07', 'Aporte', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'aaaaaaaa-0000-0000-0000-000000000002');
  `);
});

describe("migration 0001", () => {
  it("calcula saldos só com movimentações pagas", async () => {
    await actAs(OWNER);
    const { rows } = await db.query<{ name: string; balance_cents: number }>(
      "select name, balance_cents::int from account_balances order by name",
    );
    expect(rows).toEqual([
      { name: "Corrente", balance_cents: 100000 + 500000 - 20000 - 30000 },
      { name: "Investimentos", balance_cents: 30000 },
    ]);
  });

  it("esconde os dados de outro usuário, inclusive na view", async () => {
    await actAs(OTHER);
    for (const table of ["accounts", "categories", "transactions", "account_balances"]) {
      const { rows } = await db.query(`select * from ${table}`);
      expect(rows).toEqual([]);
    }
  });

  it("impede alterar dados de outro usuário", async () => {
    await actAs(OTHER);
    await db.exec("delete from transactions; update accounts set name = 'x';");
    await actAs(OWNER);
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from transactions",
    );
    expect(rows[0].n).toBe(4);
  });

  it("impede gravar registro em nome de outro usuário", async () => {
    await actAs(OTHER);
    await expect(
      db.exec(`insert into accounts (user_id, name, kind) values ('${OWNER}', 'Invasão', 'cash')`),
    ).rejects.toThrow(/row-level security/);
  });

  it("impede transferência para a mesma conta", async () => {
    await actAs(OWNER);
    const id = "aaaaaaaa-0000-0000-0000-000000000001";
    await expect(
      db.exec(`insert into transactions (type, amount_cents, date, description, account_id, to_account_id)
        values ('transfer', 100, '2026-11-08', 'Erro', '${id}', '${id}')`),
    ).rejects.toThrow(/transactions_shape/);
  });

  it("impede apagar categoria em uso", async () => {
    await actAs(OWNER);
    await expect(
      db.exec("delete from categories where name = 'Mercado'"),
    ).rejects.toThrow(/foreign key/);
  });
});
