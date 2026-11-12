import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { todayInBrazil } from "@/lib/dates";
import { centsToInput } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import type { TransactionRow } from "@/lib/transactions";
import { updateTransaction } from "../../actions";
import { loadFormOptions } from "../../queries";
import { TransactionForm } from "../../transaction-form";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await requireDb();
  const { data } = await db
    .from("transactions")
    .select("type, status, amount_cents, date, description, account_id, to_account_id, category_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const row = data as TransactionRow;
  const { accounts, categories } = await loadFormOptions(
    [row.account_id, row.to_account_id].filter((value) => value !== null),
  );

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar lançamento" />
      <Card>
        <TransactionForm
          action={updateTransaction.bind(null, id)}
          accounts={accounts}
          categories={categories}
          submitLabel="Salvar alterações"
          today={todayInBrazil()}
          initial={{
            type: row.type,
            status: row.status,
            amount: centsToInput(row.amount_cents),
            date: row.date,
            description: row.description,
            accountId: row.account_id,
            toAccountId: row.to_account_id ?? "",
            categoryId: row.category_id ?? "",
          }}
        />
      </Card>
    </div>
  );
}
