import { describe, expect, it } from "vitest";
import {
  formatDate,
  isValidDate,
  monthBounds,
  shiftMonth,
  todayInBrazil,
} from "./dates";
import { centsToInput, parseMoneyToCents } from "./money";
import {
  parseTransactionInput,
  summarizeMonth,
  type TransactionFields,
} from "./transactions";

describe("parseMoneyToCents", () => {
  it.each([
    ["1234,56", 123456],
    ["1.234,56", 123456],
    ["R$ 1.234,56", 123456],
    ["R$ 1.234,56", 123456],
    ["1.234", 123400],
    ["12.50", 1250],
    ["12,5", 1250],
    ["100", 10000],
    ["0,01", 1],
    ["1.234.567,89", 123456789],
    ["-10,00", -1000],
    ["0", 0],
  ])("converte %s", (input, expected) => {
    expect(parseMoneyToCents(input)).toBe(expected);
  });

  it("não perde centavos em valores do Excel", () => {
    expect(parseMoneyToCents(19.99)).toBe(1999);
    expect(parseMoneyToCents(1.1)).toBe(110);
  });

  it.each(["", "abc", "1,234.56", "1,234", "12,345", "1.23.45", "1,2,3"])(
    "rejeita %j",
    (input) => {
      expect(parseMoneyToCents(input)).toBeNull();
    },
  );

  it("volta para o formato do campo", () => {
    expect(centsToInput(123456)).toBe("1234,56");
    expect(centsToInput(5)).toBe("0,05");
    expect(centsToInput(-1000)).toBe("-10,00");
  });
});

describe("datas", () => {
  it("usa o dia do Brasil mesmo depois da meia-noite em UTC", () => {
    expect(todayInBrazil(new Date("2026-11-11T01:30:00Z"))).toBe("2026-11-10");
  });

  it("calcula limites na virada do ano", () => {
    expect(monthBounds("2026-12")).toEqual({
      start: "2026-12-01",
      end: "2027-01-01",
    });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("rejeita datas inexistentes", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2028-02-29")).toBe(true);
  });

  it("formata sem deslocar o dia", () => {
    expect(formatDate("2026-11-01")).toBe("01/11/2026");
  });
});

describe("parseTransactionInput", () => {
  const valid: TransactionFields = {
    type: "expense",
    status: "paid",
    amount: "10,50",
    date: "2026-11-10",
    description: " Mercado ",
    accountId: "a",
    toAccountId: "",
    categoryId: "c",
  };

  it("aceita uma despesa", () => {
    expect(parseTransactionInput(valid)).toEqual({
      ok: true,
      data: {
        type: "expense",
        status: "paid",
        amount_cents: 1050,
        date: "2026-11-10",
        description: "Mercado",
        account_id: "a",
        to_account_id: null,
        category_id: "c",
      },
    });
  });

  it("exige categoria em despesa", () => {
    expect(parseTransactionInput({ ...valid, categoryId: "" }).ok).toBe(false);
  });

  it("rejeita valor zero ou negativo", () => {
    expect(parseTransactionInput({ ...valid, amount: "0" }).ok).toBe(false);
    expect(parseTransactionInput({ ...valid, amount: "-5" }).ok).toBe(false);
  });

  it("remove a categoria de uma transferência", () => {
    const result = parseTransactionInput({
      ...valid,
      type: "transfer",
      toAccountId: "b",
    });
    expect(result.ok && result.data.category_id).toBeNull();
  });

  it("rejeita transferência para a mesma conta", () => {
    const result = parseTransactionInput({
      ...valid,
      type: "transfer",
      toAccountId: "a",
    });
    expect(result.ok).toBe(false);
  });
});

describe("summarizeMonth", () => {
  it("ignora transferências", () => {
    expect(
      summarizeMonth([
        { type: "income", amount_cents: 1000 },
        { type: "expense", amount_cents: 300 },
        { type: "transfer", amount_cents: 500 },
      ]),
    ).toEqual({ incomeCents: 1000, expenseCents: 300, balanceCents: 700 });
  });
});
