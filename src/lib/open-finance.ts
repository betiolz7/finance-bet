import {
  buildCategorySuggestions,
  buildDuplicateIndex,
  isPossibleDuplicate,
  normalizeName,
  type ExpenseHistoryItem,
} from "./import";
import { categoryFromRules, type CategoryRule } from "./category-rules";
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

export type ReviewChoice =
  | "create"
  | "ignore"
  | `match:${string}`
  | `transfer:${string}`;

export interface ReviewItem extends ReviewInput {
  kind: "expense" | "income";
  canCreate: boolean;
  candidates: { id: string; description: string }[];
  /** Entrada em outra conta sua que forma uma transferência com esta saída. */
  transferTo?: { id: string; accountName: string };
  defaultChoice: ReviewChoice;
  defaultCategoryId: string;
  note: string | null;
}

const INVOICE_PAYMENT = /fatura|credit card payment|pagamento de cart/i;
const TRANSFER_WINDOW_DAYS = 2;

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/**
 * Saída de uma conta sua e entrada de mesmo valor em outra conta sua, com até
 * 2 dias de diferença: é uma transferência, não despesa mais receita.
 * Devolve, para cada saída, a entrada que forma o par.
 */
export function pairTransfers(rows: ReviewInput[]): Map<string, ReviewInput> {
  const pairs = new Map<string, ReviewInput>();
  const used = new Set<string>();
  const credits = rows.filter((r) => r.direction === "credit" && r.accountId);
  for (const debit of rows) {
    if (debit.direction !== "debit" || !debit.accountId) continue;
    const match = credits
      .filter(
        (credit) =>
          !used.has(credit.id) &&
          credit.accountId !== debit.accountId &&
          credit.amount_cents === debit.amount_cents &&
          daysBetween(credit.date, debit.date) <= TRANSFER_WINDOW_DAYS,
      )
      .sort((a, b) => daysBetween(a.date, debit.date) - daysBetween(b.date, debit.date))[0];
    if (match) {
      pairs.set(debit.id, match);
      used.add(match.id);
    }
  }
  return pairs;
}

export function buildReviewItems(
  rows: ReviewInput[],
  context: {
    pending: PendingExpense[];
    paidHistory: ExpenseHistoryItem[];
    categories: { id: string; name: string; kind: "income" | "expense" }[];
    rules?: CategoryRule[];
  },
): ReviewItem[] {
  const suggestions = buildCategorySuggestions(context.paidHistory);
  const duplicates = buildDuplicateIndex(context.paidHistory);
  const sameDayAmount = new Set(
    context.paidHistory.map((item) => `${item.date}|${item.amount_cents}`),
  );
  const transfers = pairTransfers(rows);
  const pairedCredits = new Map(
    [...transfers.entries()].map(([debitId, credit]) => [credit.id, debitId]),
  );
  const debitById = new Map(rows.map((row) => [row.id, row]));

  return rows.map((row) => {
    const isCard = row.cardId !== null;
    const kind = row.direction === "credit" && !isCard ? "income" : "expense";
    const fitsKind = (id: string) =>
      context.categories.some((c) => c.id === id && c.kind === kind);
    const fallback = context.categories.find(
      (c) => kind === "expense" && normalizeName(c.name) === "imprevistos",
    );
    // Prioridade: regra automática, depois o que você já usou, depois Imprevistos.
    const fromRule = categoryFromRules(row.description, context.rules ?? [], fitsKind);
    const suggested = suggestions.get(normalizeName(row.description));
    const defaultCategoryId =
      fromRule ?? (suggested && fitsKind(suggested) ? suggested : (fallback?.id ?? ""));

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

    const credit = transfers.get(row.id);
    if (credit) {
      return {
        ...base,
        transferTo: { id: credit.id, accountName: credit.linkName },
        defaultChoice: `transfer:${credit.id}` as const,
        note: `Mesmo valor entrou em ${credit.linkName}. Parece transferência entre suas contas.`,
      };
    }

    const pairedDebitId = pairedCredits.get(row.id);
    if (pairedDebitId) {
      const debit = debitById.get(pairedDebitId);
      return {
        ...base,
        defaultChoice: "ignore",
        note: `Entrada da transferência vinda de ${debit?.linkName ?? "outra conta sua"}. Fica junto com ela.`,
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
        action: "create" | "match" | "ignore" | "transfer";
        category_id?: string;
        match_id?: string;
        pair_id?: string;
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
    } else if (choice.startsWith("transfer:") && choice.length > 9) {
      data.push({ id, action: "transfer", pair_id: choice.slice(9) });
    } else if (choice.startsWith("match:") && choice.length > 6) {
      data.push({ id, action: "match", match_id: choice.slice(6) });
    } else {
      return { ok: false, error: "Escolha uma ação válida." };
    }
  }
  return { ok: true, data };
}
