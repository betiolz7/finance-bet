import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, EmptyState, PageHeader, textButtonClass } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import { AccountFields, ACCOUNT_KINDS } from "./account-fields";
import { createAccount, setAccountArchived } from "./actions";

interface AccountBalance {
  id: string;
  name: string;
  kind: string;
  archived: boolean;
  balance_cents: number;
}

export default async function AccountsPage() {
  const db = await requireDb();
  const { data, error } = await db
    .from("account_balances")
    .select("id, name, kind, archived, balance_cents")
    .order("name");
  if (error) throw new Error(error.message);

  const rows = data as AccountBalance[];
  const active = rows.filter((row) => !row.archived);
  const archived = rows.filter((row) => row.archived);
  const total = active.reduce((sum, row) => sum + row.balance_cents, 0);

  return (
    <>
      <PageHeader title="Contas" />

      <Card className="mb-4">
        <p className="text-sm text-muted">Saldo total</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
          {formatCents(total)}
        </p>
      </Card>

      <Card className="mb-4">
        {active.length === 0 ? (
          <EmptyState message="Nenhuma conta cadastrada ainda." />
        ) : (
          <ul className="divide-y divide-line">
            {active.map((row) => (
              <AccountItem key={row.id} row={row} />
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 font-semibold">Nova conta</h2>
        <ActionForm action={createAccount} className="grid items-end gap-4 sm:grid-cols-4">
          <AccountFields />
          <SubmitButton>Adicionar</SubmitButton>
        </ActionForm>
      </Card>

      {archived.length > 0 && (
        <Card>
          <h2 className="mb-1 font-semibold">Arquivadas</h2>
          <ul className="divide-y divide-line">
            {archived.map((row) => (
              <AccountItem key={row.id} row={row} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function AccountItem({ row }: { row: AccountBalance }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm font-medium">{row.name}</p>
        <p className="text-xs text-muted">{ACCOUNT_KINDS[row.kind]}</p>
      </div>
      <p className="text-sm font-semibold tabular-nums">
        {formatCents(row.balance_cents)}
      </p>
      <div className="flex items-center gap-3">
        <Link href={`/contas/${row.id}/editar`} className={textButtonClass}>
          Editar
        </Link>
        <form action={setAccountArchived.bind(null, row.id, !row.archived)}>
          <button type="submit" className={textButtonClass}>
            {row.archived ? "Reativar" : "Arquivar"}
          </button>
        </form>
      </div>
    </li>
  );
}
