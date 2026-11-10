import { isValidDate } from "./dates";
import { centsToInput, parseMoneyToCents } from "./money";

export const MAX_IMPORT_LINES = 1000;

export interface SheetLine {
  name: string;
  amount: string;
  included: boolean;
}

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isTotalLine(name: string): boolean {
  return /^(sub)?total\b/.test(normalizeName(name));
}

/** Toda linha é despesa, então o sinal é ignorado. Zero é inválido. */
export function parseImportAmount(amount: string): number | null {
  const cents = parseMoneyToCents(amount);
  return cents === null || cents === 0 ? null : Math.abs(cents);
}

function isBlank(cell: unknown): boolean {
  return cell === null || cell === undefined || String(cell).trim() === "";
}

function amountText(cell: unknown): string {
  if (typeof cell === "number") {
    const cents = parseMoneyToCents(cell);
    return cents === null ? "" : centsToInput(Math.abs(cents));
  }
  return isBlank(cell) ? "" : String(cell).trim();
}

function looksLikeHeader(name: string, amount: string): boolean {
  if (parseMoneyToCents(amount) !== null) return false;
  return (
    /^(nome|descricao|item|gasto|despesa)/.test(normalizeName(name)) ||
    /^(valor|preco|custo|quantia)/.test(normalizeName(amount))
  );
}

/** Converte as células da planilha nas linhas de nome e valor. */
export function parseSheetRows(rows: unknown[][]): SheetLine[] {
  let firstColumn = Infinity;
  for (const row of rows) {
    const index = row.findIndex((cell) => !isBlank(cell));
    if (index !== -1 && index < firstColumn) firstColumn = index;
  }
  if (firstColumn === Infinity) return [];

  const lines = rows
    .map((row) => ({
      name: isBlank(row[firstColumn]) ? "" : String(row[firstColumn]).trim(),
      amount: amountText(row[firstColumn + 1]),
    }))
    .filter((line) => line.name !== "" || line.amount !== "");

  if (lines.length > 0 && looksLikeHeader(lines[0].name, lines[0].amount)) {
    lines.shift();
  }

  return lines.map((line) => ({
    ...line,
    included: !isTotalLine(line.name),
  }));
}

/** O Excel no Brasil costuma salvar CSV em Windows-1252, e não em UTF-8. */
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function detectDelimiter(text: string): string {
  const sample = text.replace(/"[^"]*"/g, "").split(/\r?\n/, 20).join("\n");
  if (sample.includes(";")) return ";";
  if (sample.includes("\t")) return "\t";
  return ",";
}

export function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endField = () => {
    row.push(field.trim());
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) endField();
    else if (char === "\n") endRow();
    else if (char !== "\r") field += char;
  }
  if (field !== "" || row.length > 0) endRow();

  // "Mercado,12,50" sem aspas: a vírgula do valor foi lida como separador.
  return rows.map((cells) =>
    delimiter === "," &&
    cells.length === 3 &&
    /^[\d.]+$/.test(cells[1]) &&
    /^\d{1,2}$/.test(cells[2])
      ? [cells[0], `${cells[1]},${cells[2]}`]
      : cells,
  );
}

export interface ExpenseHistoryItem {
  description: string;
  category_id: string;
  amount_cents: number;
  date: string;
}

/** Recebe o histórico do mais recente ao mais antigo. */
export function buildCategorySuggestions(
  history: ExpenseHistoryItem[],
): Map<string, string> {
  const suggestions = new Map<string, string>();
  for (const item of history) {
    const name = normalizeName(item.description);
    if (!suggestions.has(name)) suggestions.set(name, item.category_id);
  }
  return suggestions;
}

function duplicateKey(month: string, name: string, cents: number): string {
  return `${month}|${normalizeName(name)}|${cents}`;
}

export function buildDuplicateIndex(history: ExpenseHistoryItem[]): Set<string> {
  return new Set(
    history.map((item) =>
      duplicateKey(item.date.slice(0, 7), item.description, item.amount_cents),
    ),
  );
}

export function isPossibleDuplicate(
  index: Set<string>,
  date: string,
  name: string,
  amount: string,
): boolean {
  const cents = parseImportAmount(amount);
  return (
    cents !== null && index.has(duplicateKey(date.slice(0, 7), name, cents))
  );
}

export function lineError(line: {
  name: string;
  amount: string;
  categoryId: string;
}): string | null {
  if (!line.name.trim()) return "Informe o nome.";
  if (parseImportAmount(line.amount) === null) {
    return "Valor inválido. Corrija para importar esta linha.";
  }
  if (!line.categoryId) return "Escolha a categoria.";
  return null;
}

export interface ImportPayload {
  fileName: string;
  date: string;
  accountId: string;
  cardId?: string;
  lines: { name: string; amount: string; categoryId: string }[];
}

export type ParsedImport =
  | {
      ok: true;
      data: {
        fileName: string;
        date: string;
        accountId: string;
        cardId?: string;
        lines: { name: string; amount_cents: number; category_id: string }[];
      };
    }
  | { ok: false; error: string };

export function parseImportPayload(payload: ImportPayload): ParsedImport {
  const fail = (error: string): ParsedImport => ({ ok: false, error });

  if (!isValidDate(payload.date)) return fail("Informe uma data válida.");
  if (Boolean(payload.accountId) === Boolean(payload.cardId)) {
    return fail("Escolha uma conta ou um cartão.");
  }
  if (payload.lines.length === 0) return fail("Nenhuma linha para importar.");
  if (payload.lines.length > MAX_IMPORT_LINES) {
    return fail(`Importe no máximo ${MAX_IMPORT_LINES} linhas por vez.`);
  }

  const lines = [];
  for (const line of payload.lines) {
    const error = lineError(line);
    if (error) return fail(`${line.name || "Linha sem nome"}: ${error}`);
    lines.push({
      name: line.name.trim(),
      amount_cents: parseImportAmount(line.amount) as number,
      category_id: line.categoryId,
    });
  }

  return {
    ok: true,
    data: {
      fileName: payload.fileName,
      date: payload.date,
      accountId: payload.accountId,
      cardId: payload.cardId,
      lines,
    },
  };
}
