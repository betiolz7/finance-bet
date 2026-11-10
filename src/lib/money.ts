const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCents(cents: number): string {
  return BRL.format(cents / 100);
}

/** Valor de centavos no formato usado nos campos de texto: "1234,56". */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${Math.floor(abs / 100)},${fraction}`;
}

const PLAIN_INTEGER = /^\d+$/;
const DECIMAL_COMMA = /^(\d{1,3}(\.\d{3})+|\d+),\d{1,2}$/;
const THOUSANDS_DOTS = /^\d{1,3}(\.\d{3})+$/;
const DECIMAL_DOT = /^\d+\.\d{1,2}$/;

/**
 * Converte um valor em centavos inteiros, com sinal, sem passar por ponto
 * flutuante. Retorna null quando o texto é inválido ou ambíguo.
 */
export function parseMoneyToCents(input: string | number): number | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    const cents = Math.round(input * 100);
    return Number.isSafeInteger(cents) ? cents : null;
  }

  let text = input.replace(/R\$/gi, "").replace(/\s/g, "");
  const negative = text.startsWith("-");
  if (negative) text = text.slice(1);

  let whole: string;
  let fraction = "";

  if (PLAIN_INTEGER.test(text)) {
    whole = text;
  } else if (DECIMAL_COMMA.test(text)) {
    [whole, fraction] = text.split(",");
    whole = whole.replace(/\./g, "");
  } else if (THOUSANDS_DOTS.test(text)) {
    whole = text.replace(/\./g, "");
  } else if (DECIMAL_DOT.test(text)) {
    [whole, fraction] = text.split(".");
  } else {
    return null;
  }

  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return negative && cents !== 0 ? -cents : cents;
}
