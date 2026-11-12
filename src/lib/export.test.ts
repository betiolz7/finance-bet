import { readSheet } from "read-excel-file/universal";
import { describe, expect, it } from "vitest";
import writeExcelFile from "write-excel-file/node";
import { EXPORT_COLUMNS, EXPORT_HEADER, buildExportRows, buildSheet } from "./export";

const transactions = [
  {
    date: "2026-11-10",
    description: "Mercado",
    type: "expense",
    status: "paid",
    amount_cents: 12345,
    category: { name: "Alimentação" },
    account: { name: "Inter" },
    to_account: null,
    invoice: null,
  },
  {
    date: "2026-11-05",
    description: "Salário",
    type: "income",
    status: "pending",
    amount_cents: 500000,
    category: { name: "Salário" },
    account: { name: "Inter" },
    to_account: null,
    invoice: null,
  },
  {
    date: "2026-11-06",
    description: "Reserva",
    type: "transfer",
    status: "paid",
    amount_cents: 10000,
    category: null,
    account: { name: "Inter" },
    to_account: { name: "XP" },
    invoice: null,
  },
  {
    date: "2026-11-07",
    description: "TV",
    type: "expense",
    status: "paid",
    amount_cents: 99900,
    category: { name: "Lazer" },
    account: null,
    to_account: null,
    invoice: { card: { name: "Nubank" } },
  },
];

describe("buildExportRows", () => {
  it("usa sinal, origem e textos em português", () => {
    const rows = buildExportRows(transactions);
    expect(rows.map((r) => [r.type, r.source, r.status, r.value])).toEqual([
      ["Despesa", "Inter", "Pago", -123.45],
      ["Receita", "Inter", "Pendente", 5000],
      ["Transferência", "Inter → XP", "Pago", 100],
      ["Despesa", "Nubank", "Pago", -999],
    ]);
  });

  it("gera um .xlsx que abre com datas e valores certos", async () => {
    const buffer = await writeExcelFile(buildSheet(buildExportRows(transactions)), {
      columns: EXPORT_COLUMNS,
    }).toBuffer();
    const sheet = await readSheet(new Blob([new Uint8Array(buffer)]));

    expect(sheet[0]).toEqual(EXPORT_HEADER);
    expect(sheet[1][1]).toBe("Mercado");
    expect(sheet[1][6]).toBe(-123.45);
    const date = sheet[1][0] as unknown as Date;
    expect(date.toISOString().slice(0, 10)).toBe("2026-11-10");
  });
});
