import { Card, EmptyState, PageHeader } from "@/components/ui";
import { todayInBrazil } from "@/lib/dates";
import { createTransaction } from "../actions";
import { loadActiveCards, loadFormOptions } from "../queries";
import { TransactionForm } from "../transaction-form";

export default async function NewTransactionPage() {
  const [{ accounts, categories }, cards] = await Promise.all([
    loadFormOptions(),
    loadActiveCards(),
  ]);

  return (
    <div className="max-w-xl">
      <PageHeader title="Novo lançamento" />
      <Card>
        {accounts.length === 0 ? (
          <EmptyState
            message="Conecte seu banco antes de lançar."
            href="/open-finance"
            linkLabel="Conectar banco"
          />
        ) : categories.length === 0 ? (
          <EmptyState
            message="Cadastre suas categorias antes de lançar."
            href="/categorias"
            linkLabel="Cadastrar categorias"
          />
        ) : (
          <TransactionForm
            action={createTransaction}
            accounts={accounts}
            categories={categories}
            cards={cards}
            submitLabel="Salvar lançamento"
            initial={{
              type: "expense",
              status: "paid",
              amount: "",
              date: todayInBrazil(),
              description: "",
              accountId: accounts[0].id,
              toAccountId: "",
              categoryId: "",
            }}
          />
        )}
      </Card>
    </div>
  );
}
