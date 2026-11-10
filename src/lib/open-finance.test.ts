import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildReviewItems,
  mapPluggyTransaction,
  parseReviewDecisions,
  type ReviewInput,
} from "./open-finance";
import {
  isPluggyConfigured,
  listTransactions,
  resetPluggyAuth,
  type PluggyTransaction,
} from "./pluggy";
import { createTestDb } from "./test-db";

describe("cliente da Pluggy", () => {
  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status });
  }

  beforeEach(() => {
    resetPluggyAuth();
    vi.stubEnv("PLUGGY_CLIENT_ID", "id");
    vi.stubEnv("PLUGGY_CLIENT_SECRET", "segredo");
    vi.stubEnv("PLUGGY_ITEM_IDS", " a , b ");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("exige as credenciais, mas não os IDs das conexões", () => {
    vi.stubEnv("PLUGGY_ITEM_IDS", "");
    expect(isPluggyConfigured()).toBe(true);
    vi.stubEnv("PLUGGY_CLIENT_SECRET", "");
    expect(isPluggyConfigured()).toBe(false);
  });

  it("autentica uma vez e segue o cursor", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: URL | string, init?: RequestInit) => {
      const text = String(url);
      if (text.endsWith("/auth")) return json({ apiKey: "chave" });
      urls.push(text);
      expect((init?.headers as Record<string, string>)["X-API-KEY"]).toBe("chave");
      return urls.length === 1
        ? json({ results: [{ id: "1" }], next: "?accountId=c&after=x" })
        : json({ results: [{ id: "2" }], next: null });
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listTransactions("c", "2026-11-01");

    expect(rows.map((row) => row.id)).toEqual(["1", "2"]);
    expect(urls).toEqual([
      "https://api.pluggy.ai/v2/transactions?accountId=c&dateFrom=2026-11-01",
      "https://api.pluggy.ai/v2/transactions?accountId=c&after=x",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("renova a chave expirada e tenta de novo", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string) => {
        if (String(url).endsWith("/auth")) return json({ apiKey: "chave" });
        calls++;
        return calls === 1 ? json({}, 401) : json({ results: [], next: null });
      }),
    );
    await expect(listTransactions("c", "2026-11-01")).resolves.toEqual([]);
  });

  it("não expõe o segredo no erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 403)));
    await expect(listTransactions("c", "2026-11-01")).rejects.not.toThrow(/segredo/);
  });
});

describe("mapPluggyTransaction", () => {
  const raw: PluggyTransaction = {
    id: "p1",
    description: " Mercado ",
    amount: -19.99,
    date: "2026-11-10T03:00:00.000Z",
    type: "DEBIT",
    status: "POSTED",
  };

  it("usa o tipo para a direção e o valor absoluto", () => {
    expect(mapPluggyTransaction(raw)).toMatchObject({
      amount_cents: 1999,
      direction: "debit",
      description: "Mercado",
      date: "2026-11-10",
    });
  });

  it("não depende do sinal do valor", () => {
    expect(
      mapPluggyTransaction({ ...raw, amount: 50, type: "DEBIT" })?.direction,
    ).toBe("debit");
    expect(
      mapPluggyTransaction({ ...raw, amount: -50, type: "CREDIT" })?.direction,
    ).toBe("credit");
  });

  it("prefere o valor convertido para a moeda da conta", () => {
    expect(
      mapPluggyTransaction({ ...raw, amount: 10, amountInAccountCurrency: 55.5 })
        ?.amount_cents,
    ).toBe(5550);
  });

  it("descarta valor zero", () => {
    expect(mapPluggyTransaction({ ...raw, amount: 0 })).toBeNull();
  });

  it("lê as parcelas", () => {
    expect(
      mapPluggyTransaction({
        ...raw,
        creditCardMetadata: { installmentNumber: 2, totalInstallments: 10 },
      }),
    ).toMatchObject({ installment_number: 2, installment_total: 10 });
  });
});

describe("buildReviewItems", () => {
  const row: ReviewInput = {
    id: "b1",
    description: "PIX MERCADO",
    amount_cents: 5000,
    direction: "debit",
    date: "2026-11-10",
    pluggy_status: "POSTED",
    category: null,
    linkName: "Banco",
    accountId: "a",
    cardId: null,
  };
  const categories = [
    { id: "imp", name: "Imprevistos", kind: "expense" as const },
    { id: "sal", name: "Salário", kind: "income" as const },
  ];
  const empty = { pending: [], paidHistory: [], categories };
  const one = (input: ReviewInput, context = empty) =>
    buildReviewItems([input], context)[0];

  it("lança débito comum em Imprevistos", () => {
    expect(one(row)).toMatchObject({
      kind: "expense",
      defaultChoice: "create",
      defaultCategoryId: "imp",
    });
  });

  it("crédito no banco é receita, sem categoria padrão", () => {
    expect(one({ ...row, direction: "credit" })).toMatchObject({
      kind: "income",
      defaultCategoryId: "",
    });
  });

  it("estorno ou pagamento no cartão não pode virar gasto", () => {
    expect(one({ ...row, direction: "credit", accountId: null, cardId: "c" })).toMatchObject({
      canCreate: false,
      defaultChoice: "ignore",
    });
  });

  it.each([
    ["descrição", { description: "PAGAMENTO FATURA NUBANK" }],
    ["categoria", { category: "Credit card payment" }],
  ])("ignora pagamento de fatura pela %s", (_label, change) => {
    expect(one({ ...row, ...change }).defaultChoice).toBe("ignore");
  });

  const pending = {
    id: "fixo",
    description: "Aluguel",
    amount_cents: 5000,
    date: "2026-11-05",
    account_id: "a",
  };

  it("dá baixa no custo pendente de mesmo valor", () => {
    expect(one(row, { ...empty, pending: [pending] } as never).defaultChoice).toBe(
      "match:fixo",
    );
  });

  it.each([
    ["outra conta", { account_id: "z" }],
    ["outro mês", { date: "2026-12-05" }],
  ])("não sugere baixa de custo em %s", (_label, change) => {
    const context = { ...empty, pending: [{ ...pending, ...change }] };
    expect(one(row, context as never).defaultChoice).toBe("create");
  });

  it("ignora por padrão o que já foi lançado", () => {
    const paidHistory = [
      { description: "Compras", category_id: "imp", amount_cents: 5000, date: "2026-11-10" },
    ];
    expect(one(row, { ...empty, paidHistory } as never).defaultChoice).toBe("ignore");
  });

  it("sugere a categoria usada antes", () => {
    const cats = [...categories, { id: "ali", name: "Alimentação", kind: "expense" as const }];
    const paidHistory = [
      { description: "pix mercado", category_id: "ali", amount_cents: 1, date: "2026-01-01" },
    ];
    expect(
      one(row, { pending: [], paidHistory, categories: cats } as never).defaultCategoryId,
    ).toBe("ali");
  });
});

describe("parseReviewDecisions", () => {
  it("converte as escolhas", () => {
    expect(
      parseReviewDecisions([
        { id: "1", choice: "create", categoryId: "c" },
        { id: "2", choice: "ignore", categoryId: "" },
        { id: "3", choice: "match:x", categoryId: "" },
      ]),
    ).toEqual({
      ok: true,
      data: [
        { id: "1", action: "create", category_id: "c" },
        { id: "2", action: "ignore" },
        { id: "3", action: "match", match_id: "x" },
      ],
    });
  });

  it.each([
    [{ id: "1", choice: "create", categoryId: "" }],
    [{ id: "1", choice: "match:", categoryId: "" }],
    [{ id: "1", choice: "outra", categoryId: "" }],
  ])("recusa %j", (decision) => {
    expect(parseReviewDecisions([decision]).ok).toBe(false);
  });
});

describe("banco de dados", () => {
  const OWNER = "11111111-1111-1111-1111-111111111111";
  const OTHER = "22222222-2222-2222-2222-222222222222";
  const ACCOUNT = "aaaaaaaa-0000-0000-0000-000000000001";
  const EXPENSE = "cccccccc-0000-0000-0000-000000000001";
  const INCOME = "cccccccc-0000-0000-0000-000000000002";
  const CARD = "eeeeeeee-0000-0000-0000-000000000001";
  const BANK = "bbbbbbbb-0000-0000-0000-000000000001";
  const CREDIT = "bbbbbbbb-0000-0000-0000-000000000002";
  const FROM = "2026-11-01";

  let db: PGlite;
  let actAs: (userId: string) => Promise<void>;

  const line = (id: string, change: object = {}) => ({
    pluggy_id: id,
    description: "Compra",
    amount_cents: 1000,
    direction: "debit",
    date: "2026-11-10",
    pluggy_status: "POSTED",
    category: null,
    installment_number: null,
    installment_total: null,
    ...change,
  });

  async function sync(rows: object[], link = BANK): Promise<number> {
    const { rows: out } = await db.query<{ n: number }>(
      "select public.sync_bank_transactions($1, $2, $3) as n",
      [link, FROM, JSON.stringify(rows)],
    );
    return out[0].n;
  }

  async function idOf(pluggyId: string): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      "select id from bank_transactions where pluggy_id = $1",
      [pluggyId],
    );
    return rows[0].id;
  }

  async function apply(items: object[]) {
    await db.query("select public.apply_bank_review($1)", [JSON.stringify(items)]);
  }

  async function count(table: string): Promise<number> {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from ${table}`,
    );
    return rows[0].n;
  }

  async function balance(): Promise<number> {
    const { rows } = await db.query<{ b: number }>(
      "select balance_cents::int as b from account_balances",
    );
    return rows[0].b;
  }

  beforeEach(async () => {
    ({ db, actAs } = await createTestDb([OWNER, OTHER]));
    await actAs(OWNER);
    await db.exec(`
      insert into accounts (id, name, kind, initial_balance_cents)
        values ('${ACCOUNT}', 'Corrente', 'checking', 100000);
      insert into categories (id, name, kind) values
        ('${EXPENSE}', 'Lazer', 'expense'), ('${INCOME}', 'Salário', 'income');
      insert into credit_cards (id, name, closing_day, due_day, payment_account_id)
        values ('${CARD}', 'Cartão', 20, 28, '${ACCOUNT}');
      insert into bank_links (id, pluggy_account_id, account_id, import_from)
        values ('${BANK}', 'p-bank', '${ACCOUNT}', '${FROM}');
      insert into bank_links (id, pluggy_account_id, card_id, import_from)
        values ('${CREDIT}', 'p-card', '${CARD}', '${FROM}');
    `);
  });

  it("sincronizar não cria lançamento nem duplica a revisão", async () => {
    expect(await sync([line("1")])).toBe(1);
    expect(await sync([line("1")])).toBe(0);
    expect(await count("bank_transactions")).toBe(1);
    expect(await count("transactions")).toBe(0);
  });

  it("ignora o que veio antes da data inicial", async () => {
    await sync([line("1", { date: "2026-10-31" })]);
    expect(await count("bank_transactions")).toBe(0);
  });

  it("remove da revisão o que sumiu da Pluggy", async () => {
    await sync([line("velho")]);
    await sync([line("novo")]);
    const { rows } = await db.query("select pluggy_id from bank_transactions");
    expect(rows).toEqual([{ pluggy_id: "novo" }]);
  });

  it("não altera nem remove o que já foi decidido", async () => {
    await sync([line("1")]);
    await apply([{ id: await idOf("1"), action: "create", category_id: EXPENSE }]);
    await sync([line("1", { amount_cents: 9 })]);
    await sync([]);
    const { rows } = await db.query<{ a: number; state: string }>(
      "select amount_cents::int as a, state from bank_transactions",
    );
    expect(rows).toEqual([{ a: 1000, state: "imported" }]);
  });

  it("lança débito como despesa e crédito como receita", async () => {
    await sync([line("d"), line("c", { direction: "credit", amount_cents: 5000 })]);
    await apply([
      { id: await idOf("d"), action: "create", category_id: EXPENSE },
      { id: await idOf("c"), action: "create", category_id: INCOME },
    ]);
    expect(await balance()).toBe(104000);
  });

  it("envio repetido não lança de novo", async () => {
    await sync([line("1")]);
    const item = { id: await idOf("1"), action: "create", category_id: EXPENSE };
    await apply([item]);
    await apply([item]);
    expect(await count("transactions")).toBe(1);
  });

  it("dá baixa no custo pendente com o valor real, sem lançar outro", async () => {
    const { rows } = await db.query<{ id: string }>(`insert into transactions
      (type, status, amount_cents, date, description, category_id, account_id)
      values ('expense', 'pending', 800, '2026-11-05', 'Luz', '${EXPENSE}', '${ACCOUNT}')
      returning id`);
    await sync([line("1")]);
    await apply([{ id: await idOf("1"), action: "match", match_id: rows[0].id }]);
    expect(await count("transactions")).toBe(1);
    expect(await balance()).toBe(99000);
  });

  it("compra de cartão entra na fatura e não reduz o saldo", async () => {
    await sync([line("1")], CREDIT);
    await apply([{ id: await idOf("1"), action: "create", category_id: EXPENSE }]);
    const { rows } = await db.query<{ t: number }>(
      "select total_cents::int as t from invoice_totals",
    );
    expect(rows).toEqual([{ t: 1000 }]);
    expect(await balance()).toBe(100000);
  });

  it("recusa estorno de cartão como gasto", async () => {
    await sync([line("1", { direction: "credit" })], CREDIT);
    await expect(
      apply([{ id: await idOf("1"), action: "create", category_id: EXPENSE }]),
    ).rejects.toThrow(/card credit/);
  });

  it("ignorar não lança", async () => {
    await sync([line("1")]);
    await apply([{ id: await idOf("1"), action: "ignore" }]);
    expect(await count("transactions")).toBe(0);
  });

  it("não aplica nada se uma linha falhar", async () => {
    await sync([line("1"), line("2")]);
    await expect(
      apply([
        { id: await idOf("1"), action: "create", category_id: EXPENSE },
        { id: await idOf("2"), action: "match", match_id: EXPENSE },
      ]),
    ).rejects.toThrow(/pending/);
    expect(await count("transactions")).toBe(0);
  });

  it("isola os dados de outro usuário", async () => {
    await sync([line("1")]);
    await actAs(OTHER);
    expect(await count("bank_links")).toBe(0);
    expect(await count("bank_transactions")).toBe(0);
  });
});
