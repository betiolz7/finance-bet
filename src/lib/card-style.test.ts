import { describe, expect, it } from "vitest";
import {
  CARD_COLORS,
  CARD_PRESETS,
  DEFAULT_CARD_COLOR,
  cardTextColor,
  contrastRatio,
  detectCardStyle,
  resolveCardStyle,
} from "./card-style";
import { parseCardInput } from "./cards";

describe("detectCardStyle", () => {
  it.each([
    ["Nubank", "nubank"],
    ["Nubank Ultravioleta", "nubank-ultravioleta"],
    ["Ultravioleta", "nubank-ultravioleta"],
    ["Nubank Prêmiere", "nubank-premiere"],
    ["Nubank branco", "nubank-branco"],
    ["Nu Prata", "nubank-prata"],
    ["Inter", "inter-gold"],
    ["Inter Black", "inter-black"],
    ["Cartão Inter Black Win", "inter-black-win"],
    ["inter platinum", "inter-platinum"],
    ["C6", "c6-carbon"],
    ["C6 Gold", "c6-gold"],
    ["XP Visa Infinite", "xp"],
    ["Mercado Pago", "mercado-pago"],
  ])("reconhece %s", (name, style) => {
    expect(detectCardStyle(name)).toBe(style);
  });

  it("não confunde palavras parecidas", () => {
    expect(detectCardStyle("Internacional")).toBeNull();
    expect(detectCardStyle("Nuvem")).toBeNull();
  });
});

describe("resolveCardStyle", () => {
  it("usa o modelo reconhecido pelo nome", () => {
    expect(resolveCardStyle({ name: "Inter Black Win" })).toMatchObject({
      border: "#ff7a00",
      text: "#ffffff",
    });
  });

  it("usa acabamento e nome do banco do modelo", () => {
    expect(resolveCardStyle({ name: "Nubank Ultravioleta" })).toMatchObject({
      finish: "metal",
      wordmark: "nu",
    });
    expect(resolveCardStyle({ name: "Inter Black" })).toMatchObject({
      finish: "matte",
      wordmark: "inter",
      accent: "#ff8a1f",
    });
  });

  it("no cartão branco, o nome do banco fica roxo e o texto escuro", () => {
    expect(resolveCardStyle({ name: "Nubank branco" })).toMatchObject({
      text: "#141414",
      wordmarkColor: "#5a14c8",
    });
  });

  it("sem modelo, usa a primeira palavra do nome", () => {
    expect(resolveCardStyle({ name: "Santander Free" }).wordmark).toBe("santander");
  });

  it("usa a cor do banco quando não há modelo, inclusive com acento", () => {
    expect(resolveCardStyle({ name: "Itaú Click" }).background).toBe("#ec7000");
  });

  it("modelo escolhido vence o nome", () => {
    expect(
      resolveCardStyle({ name: "Nubank", style: "c6-pink" }).background,
    ).toBe(CARD_PRESETS["c6-pink"].background);
  });

  it("cor escolhida vence o modelo reconhecido pelo nome", () => {
    expect(resolveCardStyle({ name: "Nubank", color: "#1b1b1b" }).background).toBe(
      "#1b1b1b",
    );
  });

  it("ignora modelo desconhecido", () => {
    expect(resolveCardStyle({ name: "Meu cartão", style: "nao-existe" }).background).toBe(
      DEFAULT_CARD_COLOR,
    );
  });
});

describe("contraste do texto", () => {
  it.each([
    ["#820ad1", "#ffffff"],
    ["#ffe600", "#141414"],
    ["#9bcf53", "#141414"],
  ])("fundo %s usa texto %s", (background, text) => {
    expect(cardTextColor(background)).toBe(text);
  });

  it("o nome do banco em cor própria fica legível sobre o fundo", () => {
    for (const preset of Object.values(CARD_PRESETS)) {
      if (preset.wordmarkColor) {
        expect(contrastRatio(preset.base, preset.wordmarkColor)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("todo modelo e toda cor da lista têm texto legível", () => {
    const bases = [
      ...Object.values(CARD_PRESETS).map((preset) => preset.base),
      ...CARD_COLORS.map((color) => color.value),
    ];
    for (const base of bases) {
      expect(contrastRatio(base, cardTextColor(base))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("parseCardInput com visual", () => {
  const card = { name: "Nubank", limit: "", closingDay: "20", dueDay: "28", accountId: "a" };

  it("aceita modelo, cor e dígitos opcionais", () => {
    const result = parseCardInput({
      ...card,
      style: "nubank-ultravioleta",
      lastDigits: " 1234 ",
    });
    expect(result.ok && [result.data.style, result.data.color, result.data.last_digits]).toEqual([
      "nubank-ultravioleta",
      null,
      "1234",
    ]);
  });

  it("deixa vazio quando não informado", () => {
    const result = parseCardInput(card);
    expect(result.ok && [result.data.style, result.data.color, result.data.last_digits]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it.each([
    ["dígitos curtos", { lastDigits: "123" }],
    ["dígitos com letra", { lastDigits: "12a4" }],
    ["cor inválida", { color: "roxo" }],
    ["modelo desconhecido", { style: "banco-x" }],
  ])("recusa %s", (_label, change) => {
    expect(parseCardInput({ ...card, ...change }).ok).toBe(false);
  });
});
