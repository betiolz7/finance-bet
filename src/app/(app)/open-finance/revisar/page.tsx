import { Card, EmptyState, PageHeader, textButtonClass } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import type { ExpenseHistoryItem } from "@/lib/import";
import { formatCents } from "@/lib/money";
import {
  buildReviewItems,
  type PendingExpense,
  type ReviewInput,
} from "@/lib/open-finance";
import { ensureRecurringGenerated } from "@/lib/recurring-server";
import { requireDb } from "@/lib/supabase/server";
import { loadFormOptions } from "../../lancamentos/queries";
import { reopenBankTransaction } from "../actions";
import { ReviewList } from "./review-list";

interface BankRow {
  id: string;
  description: string;
  amount_cents: number;
  direction: "debit" | "credit";
  date: string;
  pluggy_status: string | null;
  category: string | null;
  link: {
    account_id: string | null;
    card_id: string | null;
    account: { name: string } | null;
    card: { name: string } | null;
  };
}

export default async function BankReviewPage() {
  const db = await requireDb();
  await ensureRecurringGenerated();

  const select = `id, description, amount_cents, direction, date, pluggy_status, category,
    link:bank_links(account_id, card_id, account:accounts(name), card:credit_cards(name))`;

  const [newRows, ignored, pending, history, options] = await Promise.all([
    db
      .from("bank_transactions")
      .select(select)
      .eq("state", "new")
      .order("date", { ascending: false }),
    db
      .from("bank_transactions")
      .select(select)
      .eq("state", "ignored")
      .order("date", { ascending: false })
      .limit(20),
    db
      .from("transactions")
      .select("id, description, amount_cents, date, account_id")
      .eq("type", "expense")
      .eq("status", "pending"),
    // Sugestões e aviso de duplicada usam os lançamentos pagos mais recentes.
    db
      .from("transactions")
      .select("description, category_id, amount_cents, date")
      .in("type", ["expense", "income"])
      .eq("status", "paid")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000),
    loadFormOptions(),
  ]);
  if (newRows.error) throw new Error(newRows.error.message);
  if (ignored.error) throw new Error(ignored.error.message);
  if (pending.error) throw new Error(pending.error.message);
  if (history.error) throw new Error(history.error.message);

  const inputs: ReviewInput[] = (newRows.data as unknown as BankRow[]).map((row) => ({
    id: row.id,
    description: row.description,
    amount_cents: row.amount_cents,
    direction: row.direction,
    date: row.date,
    pluggy_status: row.pluggy_status,
    category: row.category,
    linkName: row.link.account?.name ?? row.link.card?.name ?? "",
    accountId: row.link.account_id,
    cardId: row.link.card_id,
  }));

  const items = buildReviewItems(inputs, {
    pending: pending.data as PendingExpense[],
    paidHistory: history.data as ExpenseHistoryItem[],
    categories: options.categories,
  });
  const ignoredRows = ignored.data as unknown as BankRow[];

  return (
    <>
      <PageHeader title="Revisar transações do banco" />
      <Card className="mb-4">
        {items.length === 0 ? (
          <EmptyState
            message="Nenhuma transação para revisar."
            href="/open-finance"
            linkLabel="Voltar para Open Finance"
          />
        ) : (
          <ReviewList
            key={items.map((item) => item.id).join()}
            items={items}
            categories={options.categories}
          />
        )}
      </Card>

      {ignoredRows.length > 0 && (
        <Card>
          <h2 className="mb-1 font-semibold">Ignoradas recentemente</h2>
          <ul className="divide-y divide-line">
            {ignoredRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
              >
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium">{row.description}</p>
                  <p className="text-xs text-muted">{formatDate(row.date)}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {formatCents(row.amount_cents)}
                </p>
                <form action={reopenBankTransaction.bind(null, row.id)}>
                  <button type="submit" className={textButtonClass}>
                    Voltar para revisão
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
