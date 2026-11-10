import {
  buildCategorySuggestions,
  buildDuplicateIndex,
  isPossibleDuplicate,
  normalizeName,
  type ExpenseHistoryItem,
} from "./import";
import { centsToInput, parseMoneyToCents } from "./money";
import type { PluggyTransaction } from "./pluggy";

export interface BankTransactionRow {
  pluggy_id: string;
  description: string;
  amount_cents: number;
  direction: "debit" | "credit";
  date: string;
  pluggy_status: string | null;
  category: string | null;
  installment_number: number | null;
  installment_total: number | null;
}

/** Devolve null para linhas sem valor, que não têm o que lançar. */
export function mapPluggyTransaction(
  raw: PluggyTransaction,
): BankTransactionRow | null {
  const amount = raw.amountInAccountCurrency ?? raw.amount;
  const cents = parseMoneyToCents(amount);
  if (cents === null || cents === 0) return null;

  return {
    pluggy_id: raw.id,
    description: raw.description.trim() || "Sem descrição",
    amount_cents: Math.abs(cents),
    direction: raw.type === "CREDIT" ? "credit" : "debit",
    date: raw.date.slice(0, 10),
    pluggy_status: raw.status ?? null,
    category: raw.category ?? null,
    installment_number: raw.creditCardMetadata?.installmentNumber ?? null,
    installment_total: raw.creditCardMetadata?.totalInstallments ?? null,
  };
}

export interface ReviewInput {
  id: string;
  description: string;
  amount_cents: number;
  direction: "debit" | "credit";
  date: string;
  pluggy_status: string | null;
  category: string | null;
  linkName: string;
  accountId: string | null;
  cardId: string | null;
}

export interface PendingExpense {
  id: string;
  description: string;
  amount_cents: number;
  date: string;
  account_id: string | null;
}

export type ReviewChoice = "create" | "ignore" | `match:${string}`;

export interface ReviewItem extends ReviewInput {
  kind: "expense" | "income";
  canCreate: boolean;
  candidates: { id: string; description: string }[];
  defaultChoice: ReviewChoice;
  defaultCategoryId: string;
  note: string | null;
}

const INVOICE_PAYMENT = /fatura|credit card payment|pagamento de cart/i;

export function buildReviewItems(
  rows: ReviewInput[],
  context: {
    pending: PendingExpense[];
    paidHistory: ExpenseHistoryItem[];
    categories: { id: string; name: string; kind: "income" | "expense" }[];
  },
): ReviewItem[] {
  const suggestions = buildCategorySuggestions(context.paidHistory);
  const duplicates = buildDuplicateIndex(context.paidHistory);
  const sameDayAmount = new Set(
    context.paidHistory.map((item) => `${item.date}|${item.amount_cents}`),
  );

  return rows.map((row) => {
    const isCard = row.cardId !== null;
    const kind = row.direction === "credit" && !isCard ? "income" : "expense";
    const fallback = context.categories.find(
      (c) => kind === "expense" && normalizeName(c.name) === "imprevistos",
    );
    const suggested = suggestions.get(normalizeName(row.description));
    const defaultCategoryId =
      suggested && context.categories.some((c) => c.id === suggested && c.kind === kind)
        ? suggested
        : (fallback?.id ?? "");

    const base = {
      ...row,
      kind,
      defaultCategoryId,
      canCreate: true,
      candidates: [] as { id: string; description: string }[],
    } as const;

    if (isCard && row.direction === "credit") {
      return {
        ...base,
        canCreate: false,
        defaultChoice: "ignore",
        note: "Pagamento ou estorno no cartão. Não vira gasto.",
      };
    }

    const text = `${row.description} ${row.category ?? ""}`;
    if (!isCard && row.direction === "debit" && INVOICE_PAYMENT.test(text)) {
      return {
        ...base,
        defaultChoice: "ignore",
        note: "Parece pagamento de fatura. Registre em Cartões para não contar em dobro.",
      };
    }

    const month = row.date.slice(0, 7);
    const candidates =
      !isCard && row.direction === "debit"
        ? context.pending
            .filter(
              (p) =>
                p.account_id === row.accountId &&
                p.date.slice(0, 7) === month &&
                (p.amount_cents === row.amount_cents ||
                  normalizeName(p.description) === normalizeName(row.description)),
            )
            .sort(
              (a, b) =>
                Number(b.amount_cents === row.amount_cents) -
                Number(a.amount_cents === row.amount_cents),
            )
            .map(({ id, description }) => ({ id, description }))
        : [];

    if (candidates.length > 0) {
      return {
        ...base,
        candidates,
        defaultChoice: `match:${candidates[0].id}` as const,
        note: "Parece ser um custo pendente. Confira antes de confirmar.",
      };
    }

    const duplicate =
      sameDayAmount.has(`${row.date}|${row.amount_cents}`) ||
      isPossibleDuplicate(
        duplicates,
        row.date,
        row.description,
        centsToInput(row.amount_cents),
      );
    if (duplicate) {
      return {
        ...base,
        defaultChoice: "ignore",
        note: "Possível duplicada: já existe lançamento com este valor. Ignorada por padrão.",
      };
    }

    return { ...base, defaultChoice: "create", note: null };
  });
}

export interface ReviewDecision {
  id: string;
  choice: string;
  categoryId: string;
}

export type ParsedReview =
  | {
      ok: true;
      data: {
        id: string;
        action: "create" | "match" | "ignore";
        category_id?: string;
        match_id?: string;
      }[];
    }
  | { ok: false; error: string };

export function parseReviewDecisions(decisions: ReviewDecision[]): ParsedReview {
  if (decisions.length === 0) {
    return { ok: false, error: "Nenhuma transação para revisar." };
  }

  const data: Extract<ParsedReview, { ok: true }>["data"] = [];
  for (const { id, choice, categoryId } of decisions) {
    if (choice === "ignore") {
      data.push({ id, action: "ignore" });
    } else if (choice === "create") {
      if (!categoryId) {
        return { ok: false, error: "Escolha a categoria de todas as transações a lançar." };
      }
      data.push({ id, action: "create", category_id: categoryId });
    } else if (choice.startsWith("match:") && choice.length > 6) {
      data.push({ id, action: "match", match_id: choice.slice(6) });
    } else {
      return { ok: false, error: "Escolha uma ação válida." };
    }
  }
  return { ok: true, data };
}
