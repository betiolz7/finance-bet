import { normalizeName } from "./import";

// Cores e acabamentos aproximados, a partir de fotos e descrições públicas de
// cada cartão. O nome do banco aparece como texto simples; logos de bancos e de
// bandeiras não são reproduzidos, pois são marcas registradas.
export type CardFinish = "matte" | "metal" | "dots";

export interface CardPreset {
  label: string;
  group: string;
  /** Cor predominante, usada para escolher a cor do texto. */
  base: string;
  background: string;
  finish: CardFinish;
  wordmark: string;
  /** Cor do nome do banco, quando difere do texto. */
  wordmarkColor?: string;
  /** Cor do ícone de aproximação. */
  accent?: string;
  border?: string;
}

const gradient = (from: string, to: string) =>
  `linear-gradient(150deg, ${from} 0%, ${to} 100%)`;

export const CARD_PRESETS: Record<string, CardPreset> = {
  nubank: {
    label: "Nubank (roxo)",
    group: "Nubank",
    base: "#5a14c8",
    background: gradient("#7b22e0", "#4a0fa8"),
    finish: "metal",
    wordmark: "nu",
  },
  "nubank-ultravioleta": {
    label: "Nubank Ultravioleta (metal)",
    group: "Nubank",
    base: "#2c0b45",
    background: gradient("#43126b", "#1c0830"),
    finish: "metal",
    wordmark: "nu",
  },
  "nubank-premiere": {
    label: "Nubank Prêmiere (roxo-escuro)",
    group: "Nubank",
    base: "#2a1070",
    background: gradient("#3d1aa0", "#1e0b58"),
    finish: "dots",
    wordmark: "nu",
    wordmarkColor: "#d9d4ea",
  },
  "nubank-branco": {
    label: "Nubank branco",
    group: "Nubank",
    base: "#f1f1ef",
    background: gradient("#fafaf8", "#e4e4e2"),
    finish: "matte",
    wordmark: "nu",
    wordmarkColor: "#5a14c8",
  },
  "nubank-prata": {
    label: "Nubank prata (metal)",
    group: "Nubank",
    base: "#c9c9c9",
    background: gradient("#e6e6e6", "#a9a9a9"),
    finish: "metal",
    wordmark: "nu",
    wordmarkColor: "#5a14c8",
  },
  "inter-gold": {
    label: "Inter Gold (laranja)",
    group: "Inter",
    base: "#ff7a00",
    background: gradient("#ff8c26", "#f26a00"),
    finish: "matte",
    wordmark: "inter",
  },
  "inter-platinum": {
    label: "Inter Platinum (cinza)",
    group: "Inter",
    base: "#8a9096",
    background: gradient("#a3a9ae", "#70767c"),
    finish: "matte",
    wordmark: "inter",
    accent: "#ff7a00",
  },
  "inter-black": {
    label: "Inter Black (grafite)",
    group: "Inter",
    base: "#565454",
    background: gradient("#636161", "#4a4848"),
    finish: "matte",
    wordmark: "inter",
    accent: "#ff8a1f",
  },
  "inter-black-win": {
    label: "Inter Black Win (borda laranja)",
    group: "Inter",
    base: "#1c1c1c",
    background: gradient("#2a2a2a", "#111111"),
    finish: "matte",
    wordmark: "inter",
    accent: "#ff8a1f",
    border: "#ff7a00",
  },
  "c6-carbon": {
    label: "C6 Carbon",
    group: "C6 Bank",
    base: "#1d1d1d",
    background: gradient("#333333", "#111111"),
    finish: "matte",
    wordmark: "C6",
  },
  "c6-silver": {
    label: "C6 Silver",
    group: "C6 Bank",
    base: "#b9bdc2",
    background: gradient("#d6d9dc", "#9ea3a8"),
    finish: "metal",
    wordmark: "C6",
  },
  "c6-gold": {
    label: "C6 Gold",
    group: "C6 Bank",
    base: "#c49a52",
    background: gradient("#e0c07c", "#a8823c"),
    finish: "metal",
    wordmark: "C6",
  },
  "c6-red": {
    label: "C6 Red",
    group: "C6 Bank",
    base: "#c8102e",
    background: gradient("#de2a45", "#a50c25"),
    finish: "matte",
    wordmark: "C6",
  },
  "c6-blue": {
    label: "C6 Blue",
    group: "C6 Bank",
    base: "#1f4ea8",
    background: gradient("#2d63c8", "#183d86"),
    finish: "matte",
    wordmark: "C6",
  },
  "c6-pink": {
    label: "C6 Pink",
    group: "C6 Bank",
    base: "#f2a7c3",
    background: gradient("#f7bfd4", "#e98eb0"),
    finish: "matte",
    wordmark: "C6",
  },
  "c6-boreal": {
    label: "C6 Boreal Forest",
    group: "C6 Bank",
    base: "#1f5c4a",
    background: gradient("#2a7560", "#164536"),
    finish: "matte",
    wordmark: "C6",
  },
  "c6-sunset": {
    label: "C6 Sunset",
    group: "C6 Bank",
    base: "#ff9a6b",
    background: gradient("#ff7e5f", "#feb47b"),
    finish: "matte",
    wordmark: "C6",
  },
  xp: {
    label: "XP (preto)",
    group: "XP",
    base: "#121212",
    background: gradient("#262626", "#050505"),
    finish: "matte",
    wordmark: "XP",
  },
  "mercado-pago": {
    label: "Mercado Pago (amarelo)",
    group: "Mercado Pago",
    base: "#ffe600",
    background: gradient("#fff159", "#ffd800"),
    finish: "matte",
    wordmark: "mercado pago",
  },
};

export const CARD_COLORS = [
  { label: "Roxo", value: "#820ad1" },
  { label: "Laranja", value: "#ff7a00" },
  { label: "Preto", value: "#1b1b1b" },
  { label: "Vermelho", value: "#cc092f" },
  { label: "Azul-marinho", value: "#003a70" },
  { label: "Azul", value: "#0a6cff" },
  { label: "Amarelo", value: "#f8d117" },
  { label: "Verde", value: "#11c76f" },
  { label: "Verde-limão", value: "#9bcf53" },
  { label: "Grafite", value: "#4a4f55" },
  { label: "Dourado", value: "#b8954a" },
] as const;

export const DEFAULT_CARD_COLOR = "#9bcf53";

// Ordem importa: versões específicas antes da genérica do mesmo banco.
// O nome é comparado sem acentos, porque "Itaú" com acento não fecha a palavra.
const PRESET_PATTERNS: { pattern: RegExp; style: string }[] = [
  { pattern: /ultravioleta/, style: "nubank-ultravioleta" },
  { pattern: /premiere/, style: "nubank-premiere" },
  { pattern: /\bnu(bank)?\b.*\b(branco|white)\b/, style: "nubank-branco" },
  { pattern: /\bnu(bank)?\b.*\b(prata|silver)\b/, style: "nubank-prata" },
  { pattern: /\bnu(bank)?\b/, style: "nubank" },
  { pattern: /\binter\b.*\bwin\b/, style: "inter-black-win" },
  { pattern: /\binter\b.*\bblack\b/, style: "inter-black" },
  { pattern: /\binter\b.*\bplatinum\b/, style: "inter-platinum" },
  { pattern: /\binter\b/, style: "inter-gold" },
  { pattern: /\bc6\b.*\bsilver\b/, style: "c6-silver" },
  { pattern: /\bc6\b.*\bgold\b/, style: "c6-gold" },
  { pattern: /\bc6\b/, style: "c6-carbon" },
  { pattern: /\bxp\b/, style: "xp" },
  { pattern: /\bmercado ?pago\b/, style: "mercado-pago" },
];

// Bancos sem modelo confirmado: só a cor da marca.
const BANK_COLORS: { pattern: RegExp; color: string }[] = [
  { pattern: /\bitau\b/, color: "#ec7000" },
  { pattern: /\bbtg\b/, color: "#0d2c54" },
  { pattern: /\bbradesco\b/, color: "#cc092f" },
  { pattern: /\bsantander\b/, color: "#ec0000" },
  { pattern: /\bcaixa\b/, color: "#005ca9" },
  { pattern: /\b(bb|banco do brasil)\b/, color: "#f8d117" },
  { pattern: /\bpicpay\b/, color: "#11c76f" },
  { pattern: /\bneon\b/, color: "#0099ff" },
  { pattern: /\bsicredi\b/, color: "#3fa110" },
];

export function isCardStyle(style: string): boolean {
  return Object.hasOwn(CARD_PRESETS, style);
}

export function detectCardStyle(name: string): string | null {
  const normalized = normalizeName(name);
  return PRESET_PATTERNS.find(({ pattern }) => pattern.test(normalized))?.style ?? null;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Texto branco ou escuro, o que tiver mais contraste com o fundo. */
export function cardTextColor(background: string): "#ffffff" | "#141414" {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#141414")
    ? "#ffffff"
    : "#141414";
}

export interface ResolvedCardStyle {
  background: string;
  text: "#ffffff" | "#141414";
  finish: CardFinish;
  wordmark: string;
  wordmarkColor: string;
  accent: string;
  border?: string;
}

/** Prioridade: modelo escolhido, cor escolhida, modelo pelo nome, cor do banco. */
export function resolveCardStyle(card: {
  name: string;
  style?: string | null;
  color?: string | null;
}): ResolvedCardStyle {
  const chosen = card.style && isCardStyle(card.style) ? card.style : null;
  const presetId = chosen ?? (card.color ? null : detectCardStyle(card.name));

  if (presetId) {
    const preset = CARD_PRESETS[presetId];
    const text = cardTextColor(preset.base);
    return {
      background: preset.background,
      text,
      finish: preset.finish,
      wordmark: preset.wordmark,
      wordmarkColor: preset.wordmarkColor ?? text,
      accent: preset.accent ?? text,
      border: preset.border,
    };
  }

  const normalized = normalizeName(card.name);
  const color =
    card.color ??
    BANK_COLORS.find(({ pattern }) => pattern.test(normalized))?.color ??
    DEFAULT_CARD_COLOR;
  const text = cardTextColor(color);
  return {
    background: color,
    text,
    finish: "matte",
    wordmark: card.name.trim().split(/\s+/)[0]?.toLowerCase() ?? "",
    wordmarkColor: text,
    accent: text,
  };
}
