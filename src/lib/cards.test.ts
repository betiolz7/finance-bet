import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import {
  invoiceStatus,
  nextInvoiceToPay,
  parseCardInput,
  parseCardPurchaseInput,
  usedLimitCents,
} from "./cards";
import { createTestDb } from "./test-db";

const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const ACCOUNT = "aaaaaaaa-0000-0000-0000-000000000001";
const CATEGORY = "cccccccc-0000-0000-0000-000000000001";
const CARD = "eeeeeeee-0000-0000-0000-000000000001";

let db: PGlite;
let actAs: (userId: string) => Promise<void>;

async function createCard(closingDay: number, dueDay: number) {
  await db.exec(`insert into credit_cards
    (id, name, limit_cents, closing_day, due_day, payment_account_id)
    values ('${CARD}', 'Nubank', 500000, ${closingDay}, ${dueDay}, '${ACCOUNT}')`);
}

async function purchase(date: string, cents: number, installments = 1) {
  const { rows } = await db.query<{ id: string }>(
    `select public.create_card_purchase('${CARD}', '${date}', 'Compra', ${cents}, ${installments}, '${CATEGORY}') as id`,
  );
  return rows[0].id;
}

interface Parcel {
  id: string;
  cents: number;
  date: string;
  month: string;
  invoice: string;
}

async function parcels(): Promise<Parcel[]> {
  const { rows } = await db.query<Parcel>(`
    select t.id, t.amount_cents::int as cents, t.date::text,
      to_char(i.reference_month, 'YYYY-MM') as month, i.id as invoice
    from transactions t join invoices i on i.id = t.invoice_id
    where t.type = 'expense'
    order by t.installment_number, t.created_at`);
  return rows;
}

async function balance(): Promise<number> {
  const { rows } = await db.query<{ b: number }>(
    "select balance_cents::int as b from account_balances",
  );
  return rows[0].b;
}

async function pay(invoice: string, cents: number) {
  await db.exec(
    `select public.pay_invoice('${invoice}', '${ACCOUNT}', '2026-12-01', ${cents})`,
  );
}

beforeEach(async () => {
  ({ db, actAs } = await createTestDb([OWNER, OTHER]));
  await actAs(OWNER);
  await db.exec(`
    insert into accounts (id, name, kind, initial_balance_cents)
      values ('${ACCOUNT}', 'Corrente', 'checking', 100000);
    insert into categories (id, name, kind) values ('${CATEGORY}', 'Lazer', 'expense');
  `);
});

describe("em qual fatura a compra entra", () => {
  it.each([
    ["antes do fechamento", "2026-11-19", "2026-11"],
    ["no dia do fechamento", "2026-11-20", "2026-12"],
    ["depois do fechamento", "2026-11-25", "2026-12"],
  ])("vencimento depois do fechamento: %s", async (_label, date, month) => {
    await createCard(20, 28);
    await purchase(date, 1000);
    expect((await parcels())[0].month).toBe(month);
  });

  it.each([
    ["antes do fechamento", "2026-11-27", "2026-12"],
    ["no dia do fechamento", "2026-11-28", "2027-01"],
  ])("vencimento no mês seguinte: %s", async (_label, date, month) => {
    await createCard(28, 5);
    await purchase(date, 1000);
    expect((await parcels())[0].month).toBe(month);
  });

  it("grava as datas da fatura", async () => {
    await createCard(28, 5);
    await purchase("2026-11-10", 1000);
    const { rows } = await db.query(
      "select closing_date::text, due_date::text from invoices",
    );
    expect(rows).toEqual([{ closing_date: "2026-11-28", due_date: "2026-12-05" }]);
  });

  it("ajusta os dias em meses curtos", async () => {
    await createCard(30, 31);
    await purchase("2027-02-10", 1000);
    const { rows } = await db.query(
      "select closing_date::text, due_date::text from invoices",
    );
    expect(rows).toEqual([{ closing_date: "2027-02-28", due_date: "2027-02-28" }]);
  });
});

describe("parcelamento", () => {
  it("divide o valor e põe os centavos na primeira parcela", async () => {
    await createCard(20, 28);
    await purchase("2026-11-10", 10000, 3);
    expect((await parcels()).map((p) => [p.cents, p.month])).toEqual([
      [3334, "2026-11"],
      [3333, "2026-12"],
      [3333, "2027-01"],
    ]);
  });

  it("mantém a soma exata", async () => {
    await createCard(20, 28);
    await purchase("2026-11-10", 99999, 7);
    const sum = (await parcels()).reduce((total, p) => total + p.cents, 0);
    expect(sum).toBe(99999);
  });

  it("não pula mês curto nas datas das parcelas", async () => {
    await createCard(20, 28);
    await purchase("2027-01-31", 3000, 3);
    expect((await parcels()).map((p) => p.date)).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("recusa parcelas maiores que o valor", async () => {
    await createCard(20, 28);
    await expect(purchase("2026-11-10", 2, 3)).rejects.toThrow(/invalid purchase/);
    expect(await parcels()).toEqual([]);
  });
});

describe("pagamento de fatura", () => {
  it("só a fatura paga reduz o saldo", async () => {
    await createCard(20, 28);
    await purchase("2026-11-10", 30000);
    expect(await balance()).toBe(100000);

    await pay((await parcels())[0].invoice, 30000);
    expect(await balance()).toBe(70000);
  });

  it("não conta o pagamento no total da fatura", async () => {
    await createCard(20, 28);
    await purchase("2026-11-10", 30000);
    await pay((await parcels())[0].invoice, 30000);
    const { rows } = await db.query<{ t: number }>(
      "select total_cents::int as t from invoice_totals",
    );
    expect(rows[0].t).toBe(30000);
  });

  it("não paga duas vezes", async () => {
    await createCard(20, 28);
    await purchase("2026-11-10", 30000);
    const { invoice } = (await parcels())[0];
    await pay(invoice, 30000);
    await expect(pay(invoice, 30000)).rejects.toThrow(/not open/);
    expect(await balance()).toBe(70000);
  });

  it("desfazer devolve o saldo e reabre a fatura", async () => {
    await createCard(20, 28);
    await purchase("2026-11-10", 30000);
    const { invoice } = (await parcels())[0];
    await pay(invoice, 30000);
    await db.exec(`select public.unpay_invoice('${invoice}')`);
    expect(await balance()).toBe(100000);
    const { rows } = await db.query("select paid_at from invoices");
    expect(rows).toEqual([{ paid_at: null }]);
  });

  it("compra atrasada em fatura paga vai para a próxima aberta", async () => {
    await createCard(20, 28);
    await purchase("2026-11-10", 1000);
    await pay((await parcels())[0].invoice, 1000);
    await purchase("2026-11-11", 2000);
    expect((await parcels()).map((p) => p.month)).toEqual(["2026-11", "2026-12"]);
  });
});

describe("correção manual", () => {
  it("move uma parcela para a próxima fatura", async () => {
    await createCard(20, 28);
    await purchase("2026-11-10", 1000);
    await db.exec(`select public.move_card_transaction('${(await parcels())[0].id}', 1)`);
    expect((await parcels())[0].month).toBe("2026-12");
  });

  it("não move para fatura paga", async () => {
    await createCard(20, 28);
    await purchase("2026-11-10", 1000);
    await pay((await parcels())[0].invoice, 1000);
    await purchase("2026-11-25", 1000);
    const target = (await parcels())[1].id;
    await expect(
      db.exec(`select public.move_card_transaction('${target}', -1)`),
    ).rejects.toThrow(/paid/);
  });

  it("apagar a compra mantém parcelas de faturas pagas", async () => {
    await createCard(20, 28);
    const group = await purchase("2026-11-10", 3000, 3);
    await pay((await parcels())[0].invoice, 1000);
    await db.exec(`select public.delete_card_purchase('${group}')`);
    expect((await parcels()).map((p) => p.month)).toEqual(["2026-11"]);
    expect(await balance()).toBe(99000);
  });
});

describe("importação para cartão", () => {
  it("lança na fatura sem reduzir o saldo e pode ser desfeita", async () => {
    await createCard(20, 28);
    const { rows } = await db.query<{ id: string }>(
      "select public.import_card_expenses('a.xlsx', '2026-11-10', $1, $2) as id",
      [CARD, JSON.stringify([{ name: "Luz", amount_cents: 8000, category_id: CATEGORY }])],
    );
    expect((await parcels()).map((p) => p.month)).toEqual(["2026-11"]);
    expect(await balance()).toBe(100000);
    await db.exec(`delete from imports where id = '${rows[0].id}'`);
    expect(await parcels()).toEqual([]);
  });
});

describe("segurança e regras gerais", () => {
  it("outro usuário não vê nem paga a fatura", async () => {
    await createCard(20, 28);
    await purchase("2026-11-10", 1000);
    const { invoice } = (await parcels())[0];
    await actAs(OTHER);
    expect((await db.query("select * from credit_cards")).rows).toEqual([]);
    expect((await db.query("select * from invoice_totals")).rows).toEqual([]);
    await expect(pay(invoice, 1000)).rejects.toThrow(/not open/);
  });

  it("despesa precisa ter conta ou fatura, nunca as duas", async () => {
    await expect(
      db.exec(`insert into transactions (type, amount_cents, date, description, category_id)
        values ('expense', 100, '2026-11-10', 'Sem origem', '${CATEGORY}')`),
    ).rejects.toThrow(/transactions_shape/);
  });
});

describe("validação dos formulários", () => {
  const card = { name: "Nubank", limit: "5.000,00", closingDay: "20", dueDay: "28", accountId: "a" };
  const buy = {
    cardId: "c",
    date: "2026-11-10",
    description: "TV",
    amount: "1.000,00",
    installments: "10",
    categoryId: "x",
  };

  it("aceita cartão válido", () => {
    expect(parseCardInput(card).ok).toBe(true);
  });

  it("recusa dia inválido", () => {
    expect(parseCardInput({ ...card, closingDay: "32" }).ok).toBe(false);
    expect(parseCardInput({ ...card, dueDay: "0" }).ok).toBe(false);
  });

  it("aceita compra parcelada", () => {
    const result = parseCardPurchaseInput(buy);
    expect(result.ok && result.data.totalCents).toBe(100000);
  });

  it.each(["0", "49", "1.5", "abc"])("recusa %j parcelas", (installments) => {
    expect(parseCardPurchaseInput({ ...buy, installments }).ok).toBe(false);
  });
});

describe("resumo do cartão", () => {
  const open = { paid_at: null, due_date: "2026-12-28", total_cents: 100 };
  const later = { paid_at: null, due_date: "2027-01-28", total_cents: 50 };
  const paid = { paid_at: "2026-11-28", due_date: "2026-11-28", total_cents: 999 };
  const empty = { paid_at: null, due_date: "2026-10-28", total_cents: 0 };

  it("usa o limite com as faturas não pagas", () => {
    expect(usedLimitCents([open, later, paid])).toBe(150);
  });

  it("escolhe o vencimento mais próximo com valor", () => {
    expect(nextInvoiceToPay([later, paid, empty, open])).toBe(open);
  });

  it("calcula a situação", () => {
    const invoice = { paid_at: null, closing_date: "2026-11-20" };
    expect(invoiceStatus(invoice, "2026-11-19")).toBe("open");
    expect(invoiceStatus(invoice, "2026-11-20")).toBe("closed");
    expect(invoiceStatus({ ...invoice, paid_at: "2026-11-28" }, "2026-11-30")).toBe("paid");
  });
});
