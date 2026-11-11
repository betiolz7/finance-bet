import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapInvestments, summarizePortfolio } from "./investments";
import { listInvestments, resetPluggyAuth, type PluggyInvestment } from "./pluggy";

const base: PluggyInvestment = {
  id: "1",
  itemId: "item",
  name: "CDB Banco X",
  type: "FIXED_INCOME",
  subtype: "CDB",
  currencyCode: "BRL",
  balance: 1359.39,
  amountOriginal: 1200,
  amountProfit: 159.39,
  rateType: "CDI",
  dueDate: "2028-01-15T00:00:00.000Z",
  issuer: "Banco X",
  status: "ACTIVE",
};

describe("mapInvestments", () => {
  it("converte valores e monta a descrição", () => {
    expect(mapInvestments([base])).toEqual([
      {
        id: "1",
        name: "CDB Banco X",
        type: "FIXED_INCOME",
        typeLabel: "Renda fixa",
        detail: "CDB · Banco X · Indexado ao CDI",
        currencyCode: "BRL",
        balanceCents: 135939,
        investedCents: 120000,
        profitCents: 15939,
        dueDate: "2028-01-15",
      },
    ]);
  });

  it("remove o que já foi totalmente resgatado", () => {
    expect(mapInvestments([{ ...base, status: "TOTAL_WITHDRAWAL" }])).toEqual([]);
  });

  it("mantém rendimento desconhecido como vazio, e não como zero", () => {
    expect(mapInvestments([{ ...base, amountProfit: null }])[0].profitCents).toBeNull();
  });

  it("agrupa tipo desconhecido em Outros", () => {
    expect(mapInvestments([{ ...base, type: "CRYPTO" }])[0].typeLabel).toBe("Outros");
  });

  it("ordena do maior saldo para o menor", () => {
    const rows = mapInvestments([base, { ...base, id: "2", balance: 9000 }]);
    expect(rows.map((row) => row.id)).toEqual(["2", "1"]);
  });
});

describe("summarizePortfolio", () => {
  const rows = mapInvestments([
    base,
    { ...base, id: "2", type: "EQUITY", balance: 640.61, amountProfit: null },
    { ...base, id: "3", currencyCode: "USD", balance: 100 },
  ]);
  const summary = summarizePortfolio(rows);

  it("soma só os investimentos em reais", () => {
    expect(summary.totalCents).toBe(200000);
    expect(summary.foreign.map((row) => row.id)).toEqual(["3"]);
  });

  it("soma o rendimento só de quem informa", () => {
    expect(summary).toMatchObject({
      profitCents: 15939,
      withProfit: 1,
      withoutProfit: 1,
    });
  });

  it("separa por tipo na ordem fixa das cores", () => {
    expect(summary.byType.map((group) => [group.label, group.cents])).toEqual([
      ["Renda fixa", 135939],
      ["Ações", 64061],
    ]);
  });
});

describe("listInvestments", () => {
  beforeEach(() => {
    resetPluggyAuth();
    vi.stubEnv("PLUGGY_CLIENT_ID", "id");
    vi.stubEnv("PLUGGY_CLIENT_SECRET", "segredo");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("percorre todas as páginas", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string) => {
        const text = String(url);
        if (text.endsWith("/auth")) {
          return new Response(JSON.stringify({ apiKey: "chave" }));
        }
        urls.push(text);
        const page = urls.length;
        return new Response(
          JSON.stringify({ results: [{ id: String(page) }], totalPages: 2 }),
        );
      }),
    );

    const rows = await listInvestments("item");
    expect(rows.map((row) => row.id)).toEqual(["1", "2"]);
    expect(urls).toEqual([
      "https://api.pluggy.ai/investments?itemId=item&page=1",
      "https://api.pluggy.ai/investments?itemId=item&page=2",
    ]);
  });
});
