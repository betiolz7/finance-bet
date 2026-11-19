import { describe, expect, it } from "vitest";
import { matchesOrigin, originOf } from "./transaction-origin";

describe("originOf", () => {
  it.each([
    [{ bank: [{ id: "b" }] }, "bank"],
    [{ bank: [{ id: "b" }], recurring_rule_id: "r" }, "bank"],
    [{ bank: [], import_id: "i" }, "sheet"],
    [{ recurring_rule_id: "r" }, "fixed"],
    [{ bank: null }, "manual"],
    [{}, "manual"],
  ])("classifica %j como %s", (row, origin) => {
    expect(originOf(row)).toBe(origin);
  });
});

describe("matchesOrigin", () => {
  it("separa o que veio do banco do que você adicionou", () => {
    expect(matchesOrigin("bank", "banco")).toBe(true);
    expect(matchesOrigin("manual", "banco")).toBe(false);
    expect(matchesOrigin("sheet", "meus")).toBe(true);
    expect(matchesOrigin("fixed", "meus")).toBe(true);
    expect(matchesOrigin("bank", "meus")).toBe(false);
    expect(matchesOrigin("bank", "todos")).toBe(true);
  });
});
