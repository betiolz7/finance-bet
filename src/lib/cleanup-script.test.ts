import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createTestDb } from "./test-db";

it("o script de limpeza apaga só o usuário escolhido, sem violar vínculos", async () => {
  const owner = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";
  const { db, actAs } = await createTestDb([owner, other]);
  await db.exec(`
    alter table auth.users add column email text;
    update auth.users set email = 'dono@exemplo.com' where id = '${owner}';
    update auth.users set email = 'testador@exemplo.com' where id = '${other}';
  `);

  // Dados de outro usuário: precisam sobreviver à limpeza.
  await actAs(other);
  await db.exec(`
    insert into accounts (name, kind) values ('Conta do testador', 'checking');
    reset role;
  `);

  await actAs(owner);
  await db.exec(`
    insert into accounts (id, name, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Conta', 'checking');
    insert into categories (id, name, kind) values ('cccccccc-0000-0000-0000-000000000001', 'Lazer', 'expense');
    insert into credit_cards (id, name, closing_day, due_day, payment_account_id)
      values ('eeeeeeee-0000-0000-0000-000000000001', 'Cartão', 20, 28, 'aaaaaaaa-0000-0000-0000-000000000001');
    select public.create_card_purchase('eeeeeeee-0000-0000-0000-000000000001', '2026-11-10', 'Compra', 3000, 3, 'cccccccc-0000-0000-0000-000000000001');
    select public.pay_invoice((select id from invoices order by reference_month limit 1), 'aaaaaaaa-0000-0000-0000-000000000001', '2026-11-28', 1000);
    select public.import_expenses('a.xlsx', '2026-11-10', 'aaaaaaaa-0000-0000-0000-000000000001',
      '[{"name":"Luz","amount_cents":100,"category_id":"cccccccc-0000-0000-0000-000000000001"}]');
    insert into recurring_rules (description, amount_cents, due_day, category_id, account_id, start_month)
      values ('Aluguel', 100, 5, 'cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-11-01');
    select public.generate_recurring_transactions('2026-11-01');
    insert into goals (name, target_cents, deadline, account_id)
      values ('Meta', 100, '2027-01-01', 'aaaaaaaa-0000-0000-0000-000000000001');
    insert into budgets (category_id, month, limit_cents) values ('cccccccc-0000-0000-0000-000000000001', '2026-11-01', 100);
    insert into bank_items (item_id) values ('item-1');
    insert into bank_links (id, pluggy_account_id, item_id, account_id, import_from)
      values ('bbbbbbbb-0000-0000-0000-000000000001', 'p1', 'item-1', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-11-01');
    select public.sync_bank_transactions('bbbbbbbb-0000-0000-0000-000000000001', '2026-11-01',
      '[{"pluggy_id":"t1","description":"X","amount_cents":100,"direction":"debit","date":"2026-11-10"}]');
    reset role;
  `);

  const script = readFileSync(
    join(process.cwd(), "supabase/scripts/limpar-dados-de-teste.sql"),
    "utf8",
  );
  const cleanup = script.slice(script.indexOf("begin;"));
  expect(cleanup).toContain("SEU-EMAIL@exemplo.com");
  // Sem trocar o e-mail, o script para em vez de apagar.
  await expect(db.exec(cleanup)).rejects.toThrow(/E-mail não encontrado/);
  await db.exec("rollback");
  await db.exec(cleanup.replaceAll("SEU-EMAIL@exemplo.com", "dono@exemplo.com"));

  const count = async (table: string) =>
    (await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n;
  for (const table of [
    "transactions", "imports", "invoices", "credit_cards", "accounts",
    "recurring_rules", "goals", "bank_transactions", "bank_links",
  ]) {
    expect(await count(`${table} where user_id = '${owner}'`), table).toBe(0);
  }
  expect(await count(`accounts where user_id = '${other}'`)).toBe(1);
  expect(await count("categories")).toBe(1);
  expect(await count("budgets")).toBe(1);
  expect(await count("bank_items")).toBe(1);
});
