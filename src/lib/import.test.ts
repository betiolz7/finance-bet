import type { PGlite } from "@electric-sql/pglite";
import { readSheet } from "read-excel-file/universal";
import { beforeEach, describe, expect, it } from "vitest";
import writeExcelFile from "write-excel-file/node";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCategorySuggestions,
  buildDuplicateIndex,
  decodeCsv,
  isPossibleDuplicate,
  parseCsv,
  parseImportAmount,
  parseImportPayload,
  parseSheetRows,
} from "./import";
import { createTestDb } from "./test-db";

describe("parseSheetRows", () => {
  it("lê com cabeçalho", () => {
    expect(
      parseSheetRows([
        ["Nome", "Valor"],
        ["Mercado", 19.99],
      ]),
    ).toEqual([{ name: "Mercado", amount: "19,99", included: true }]);
  });

  it("lê sem cabeçalho", () => {
    expect(parseSheetRows([["Mercado", "R$ 1.234,56"]])).toEqual([
      { name: "Mercado", amount: "R$ 1.234,56", included: true },
    ]);
  });

  it("não confunde a primeira despesa com cabeçalho", () => {
    expect(parseSheetRows([["Despesa do carro", 100]])).toHaveLength(1);
  });

  it("ignora linhas vazias e colunas vazias à esquerda", () => {
    expect(
      parseSheetRows([
        [null, null, null],
        [null, "Luz", 80],
        [null, null, null],
        [null, "Água", 40.5],
      ]).map((line) => line.name),
    ).toEqual(["Luz", "Água"]);
  });

  it("ignora o sinal negativo", () => {
    expect(parseSheetRows([["Luz", -80]])[0].amount).toBe("80,00");
  });

  it("deixa linhas de total desmarcadas", () => {
    const lines = parseSheetRows([
      ["Luz", 80],
      ["TOTAL", 80],
      ["Subtotal", 80],
    ]);
    expect(lines.map((line) => line.included)).toEqual([true, false, false]);
  });

  it("mantém linha com valor inválido para correção", () => {
    expect(parseSheetRows([["Luz", "oitenta"]])).toEqual([
      { name: "Luz", amount: "oitenta", included: true },
    ]);
  });

  it("não quebra com planilha vazia", () => {
    expect(parseSheetRows([])).toEqual([]);
    expect(parseSheetRows([[null, ""]])).toEqual([]);
  });
});

describe("arquivo .xlsx real", () => {
  it("lê nome e valor com o mesmo leitor do app", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "planilha-")), "gastos.xlsx");
    await writeExcelFile([
      [{ value: "Nome" }, { value: "Valor" }],
      [{ value: "Conserto do carro" }, { value: 1234.56 }],
      [{ value: "Farmácia" }, { value: "R$ 19,90" }],
    ]).toFile(path);

    const bytes = readFileSync(path);
    const blob = new Blob([new Uint8Array(bytes)]);
    expect(parseSheetRows(await readSheet(blob))).toEqual([
      { name: "Conserto do carro", amount: "1234,56", included: true },
      { name: "Farmácia", amount: "R$ 19,90", included: true },
    ]);
  });
});

describe("CSV", () => {
  it.each([
    ["ponto e vírgula", "Luz;80,50\nÁgua;40"],
    ["tabulação", "Luz\t80,50\nÁgua\t40"],
    ["vírgula com aspas", 'Luz,"80,50"\nÁgua,40'],
    ["vírgula sem aspas no valor", "Luz,80,50\nÁgua,40"],
    ["quebra de linha do Windows", "Luz;80,50\r\nÁgua;40\r\n"],
  ])("lê com %s", (_label, text) => {
    expect(parseCsv(text)).toEqual([
      ["Luz", "80,50"],
      ["Água", "40"],
    ]);
  });

  it("aceita aspas e separador dentro do nome", () => {
    expect(parseCsv('"Pão; ""especial""";5')).toEqual([['Pão; "especial"', "5"]]);
  });

  it("decodifica UTF-8 com BOM", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0xc3, 0xa1]);
    expect(decodeCsv(bytes)).toBe("á");
  });

  it("decodifica o formato salvo pelo Excel", () => {
    expect(decodeCsv(new Uint8Array([0xc1, 0x67, 0x75, 0x61]))).toBe("Água");
  });
});

describe("regras da prévia", () => {
  const history = [
    { description: "Farmácia", category_id: "nova", amount_cents: 1990, date: "2026-11-05" },
    { description: "farmacia ", category_id: "antiga", amount_cents: 500, date: "2026-01-05" },
  ];

  it("sugere a categoria mais recente, sem diferenciar acentos", () => {
    expect(buildCategorySuggestions(history).get("farmacia")).toBe("nova");
  });

  it("sinaliza duplicada só no mesmo mês e valor", () => {
    const index = buildDuplicateIndex(history);
    expect(isPossibleDuplicate(index, "2026-11-20", "FARMÁCIA", "19,90")).toBe(true);
    expect(isPossibleDuplicate(index, "2026-12-20", "Farmácia", "19,90")).toBe(false);
    expect(isPossibleDuplicate(index, "2026-11-20", "Farmácia", "20,00")).toBe(false);
  });

  it("rejeita valor zero", () => {
    expect(parseImportAmount("0,00")).toBeNull();
    expect(parseImportAmount("-5")).toBe(500);
  });

  const line = { name: "Luz", amount: "80,00", categoryId: "c" };
  const payload = { fileName: "a.csv", date: "2026-11-10", accountId: "a", lines: [line] };

  it("valida o lote no servidor", () => {
    expect(parseImportPayload(payload)).toEqual({
      ok: true,
      data: {
        fileName: "a.csv",
        date: "2026-11-10",
        accountId: "a",
        lines: [{ name: "Luz", amount_cents: 8000, category_id: "c" }],
      },
    });
  });

  it.each([
    ["sem linhas", { ...payload, lines: [] }],
    ["data inválida", { ...payload, date: "2026-02-30" }],
    ["sem conta", { ...payload, accountId: "" }],
    ["valor inválido", { ...payload, lines: [{ ...line, amount: "x" }] }],
    ["sem categoria", { ...payload, lines: [{ ...line, categoryId: "" }] }],
  ])("recusa %s", (_label, input) => {
    expect(parseImportPayload(input).ok).toBe(false);
  });
});

describe("gravação do lote", () => {
  const OWNER = "11111111-1111-1111-1111-111111111111";
  const OTHER = "22222222-2222-2222-2222-222222222222";
  const ACCOUNT = "aaaaaaaa-0000-0000-0000-000000000001";
  const CATEGORY = "cccccccc-0000-0000-0000-000000000001";
  const MISSING = "cccccccc-0000-0000-0000-00000000dead";

  let db: PGlite;
  let actAs: (userId: string) => Promise<void>;

  async function runImport(lines: object[]): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      "select public.import_expenses('a.xlsx', '2026-11-10', $1, $2) as id",
      [ACCOUNT, JSON.stringify(lines)],
    );
    return rows[0].id;
  }

  async function balance(): Promise<number> {
    const { rows } = await db.query<{ b: number }>(
      "select balance_cents::int as b from account_balances",
    );
    return rows[0].b;
  }

  const luz = { name: "Luz", amount_cents: 8000, category_id: CATEGORY };
  const agua = { name: "Água", amount_cents: 4000, category_id: CATEGORY };

  beforeEach(async () => {
    ({ db, actAs } = await createTestDb([OWNER, OTHER]));
    await actAs(OWNER);
    await db.exec(`
      insert into accounts (id, name, kind, initial_balance_cents)
        values ('${ACCOUNT}', 'Corrente', 'checking', 100000);
      insert into categories (id, name, kind) values ('${CATEGORY}', 'Imprevistos', 'expense');
    `);
  });

  it("lança como despesa paga e reduz o saldo", async () => {
    await runImport([luz, agua]);
    const { rows } = await db.query(
      "select type, status, date::text, description from transactions order by amount_cents desc",
    );
    expect(rows).toEqual([
      { type: "expense", status: "paid", date: "2026-11-10", description: "Luz" },
      { type: "expense", status: "paid", date: "2026-11-10", description: "Água" },
    ]);
    expect(await balance()).toBe(88000);
  });

  it("não grava nada se uma linha falhar", async () => {
    await expect(
      runImport([luz, { ...agua, category_id: MISSING }]),
    ).rejects.toThrow();
    const counts = await db.query<{ i: number; t: number }>(`select
      (select count(*)::int from imports) as i,
      (select count(*)::int from transactions) as t`);
    expect(counts.rows[0]).toEqual({ i: 0, t: 0 });
  });

  it("desfaz apenas o lote escolhido", async () => {
    const first = await runImport([luz]);
    await runImport([agua]);
    await db.exec(`delete from imports where id = '${first}'`);
    const { rows } = await db.query("select description from transactions");
    expect(rows).toEqual([{ description: "Água" }]);
    expect(await balance()).toBe(96000);
  });

  it("não deixa outro usuário ver ou desfazer o lote", async () => {
    const id = await runImport([luz]);
    await actAs(OTHER);
    expect((await db.query("select * from imports")).rows).toEqual([]);
    await db.exec(`delete from imports where id = '${id}'`);
    await actAs(OWNER);
    expect((await db.query("select * from imports")).rows).toHaveLength(1);
  });
});
