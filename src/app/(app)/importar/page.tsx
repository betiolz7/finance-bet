import { ConfirmButton } from "@/components/forms";
import { Card, EmptyState, PageHeader, textButtonClass } from "@/components/ui";
import { formatDate, todayInBrazil } from "@/lib/dates";
import type { CategoryRule } from "@/lib/category-rules";
import type { ExpenseHistoryItem } from "@/lib/import";
import { formatCents } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import { loadActiveCards, loadFormOptions } from "../lancamentos/queries";
import { undoImport } from "./actions";
import { ImportWizard } from "./import-wizard";

interface ImportBatch {
  id: string;
  file_name: string;
  applied_date: string;
  account: { name: string } | null;
  card: { name: string } | null;
  transactions: { amount_cents: number }[];
}

export default async function ImportPage() {
  const db = await requireDb();
  const [options, cards, history, batches, rules] = await Promise.all([
    loadFormOptions(),
    loadActiveCards(),
    // As sugestões e o aviso de duplicada usam os gastos mais recentes.
    db
      .from("transactions")
      .select("description, category_id, amount_cents, date")
      .eq("type", "expense")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000),
    db
      .from("imports")
      .select(
        "id, file_name, applied_date, account:accounts(name), card:credit_cards(name), transactions(amount_cents)",
      )
      .order("created_at", { ascending: false })
      .limit(20),
    db.from("category_rules").select("pattern, category_id"),
  ]);
  if (history.error) throw new Error(history.error.message);
  if (rules.error) throw new Error(rules.error.message);
  if (batches.error) throw new Error(batches.error.message);

  const { accounts, categories } = options;
  const rows = batches.data as unknown as ImportBatch[];
  const ready =
    accounts.length > 0 && categories.some((c) => c.kind === "expense");

  return (
    <>
      <PageHeader title="Importar planilha" />

      {ready ? (
        <ImportWizard
          accounts={accounts}
          categories={categories}
          cards={cards}
          history={history.data as ExpenseHistoryItem[]}
          rules={rules.data as CategoryRule[]}
          today={todayInBrazil()}
        />
      ) : (
        <Card className="mb-4">
          <EmptyState
            message="Conecte seu banco e cadastre uma categoria de despesa antes de importar."
            href={accounts.length === 0 ? "/open-finance" : "/categorias"}
            linkLabel={accounts.length === 0 ? "Conectar banco" : "Cadastrar categoria"}
          />
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-1 font-semibold">Importações anteriores</h2>
          <ul className="divide-y divide-line">
            {rows.map((batch) => (
              <BatchItem key={batch.id} batch={batch} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function BatchItem({ batch }: { batch: ImportBatch }) {
  const count = batch.transactions.length;
  const total = batch.transactions.reduce((sum, t) => sum + t.amount_cents, 0);

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium">{batch.file_name}</p>
        <p className="text-xs text-muted">
          {formatDate(batch.applied_date)} · {batch.account?.name ?? batch.card?.name} · {count}{" "}
          {count === 1 ? "gasto" : "gastos"}
        </p>
      </div>
      <p className="text-sm font-semibold tabular-nums">{formatCents(total)}</p>
      <form action={undoImport.bind(null, batch.id)}>
        <ConfirmButton
          message={`Desfazer a importação de "${batch.file_name}"? Todos os lançamentos deste arquivo serão apagados (${count}).`}
          className={textButtonClass}
        >
          Desfazer
        </ConfirmButton>
      </form>
    </li>
  );
}
