import { describe, expect, it } from "vitest";
import { perItem } from "./per-item";

describe("perItem", () => {
  it("mantém as conexões que responderam quando uma falha", async () => {
    const outcome = await perItem(["inter", "removida", "xp"], async (id) => {
      if (id === "removida") throw new Error("404");
      return id.toUpperCase();
    });
    expect(outcome).toEqual({
      results: [
        { itemId: "inter", value: "INTER" },
        { itemId: "xp", value: "XP" },
      ],
      failed: ["removida"],
    });
  });

  it("funciona sem conexões", async () => {
    expect(await perItem([], async () => 1)).toEqual({ results: [], failed: [] });
  });
});
