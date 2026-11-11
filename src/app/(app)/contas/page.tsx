import Link from "next/link";
import { BankIcon, type Institution } from "@/components/bank-icon";
import {
  Card,
  EmptyState,
  PageHeader,
  secondaryButtonClass,
  textButtonClass,
} from "@/components/ui";
import { formatCents } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import { ACCOUNT_KINDS } from "./account-fields";
import { setAccountArchived } from "./actions";

interface AccountRow extends Institution {
  id: string;
  name: string;
  kind: string;
  archived: boolean;
  balance_cents: number;
  connected: boolean;
}

export default async function AccountsPage() {
  const db = await requireDb();
  const [balances, details, links] = await Promise.all([
    db
      .from("account_balances")
      .select("id, name, kind, archived, balance_cents")
      .order("name"),
    db
      .from("accounts")
      .select("id, institution_name, institution_logo, institution_color"),
    db.from("bank_links").select("account_id").not("account_id", "is", null),
  ]);
  if (balances.error) throw new Error(balances.error.message);
  if (details.error) throw new Error(details.error.message);
  if (links.error) throw new Error(links.error.message);

  const detailById = new Map(
    (details.data as (Institution & { id: string })[]).map((row) => [row.id, row]),
  );
  const connectedIds = new Set(
    (links.data as { account_id: string }[]).map((row) => row.account_id),
  );
  const rows: AccountRow[] = (
    balances.data as Omit<AccountRow, "connected">[]
  ).map((row) => ({
    ...row,
    ...detailById.get(row.id),
    connected: connectedIds.has(row.id),
  }));

  const connected = rows.filter((row) => row.connected && !row.archived);
  const manual = rows.filter((row) => !row.connected && !row.archived);
  const archived = rows.filter((row) => row.archived);
  const total = [...connected, ...manual].reduce(
    (sum, row) => sum + row.balance_cents,
    0,
  );

  return (
    <>
      <PageHeader
        title="Contas"
        action={
          <Link href="/open-finance" className={secondaryButtonClass}>
            Conectar banco
          </Link>
        }
      />

      <Card className="mb-4">
        <p className="text-sm text-muted">Saldo total</p>
        <p className="mt-1 whitespace-nowrap text-3xl font-semibold tracking-tight tabular-nums">
          {formatCents(total)}
        </p>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-1 font-semibold">Conectadas pelo Open Finance</h2>
        {connected.length === 0 ? (
          <EmptyState
            message="Nenhuma conta conectada ainda."
            href="/open-finance"
            linkLabel="Conectar banco"
          />
        ) : (
          <ul className="divide-y divide-line">
            {connected.map((row) => (
              <AccountItem key={row.id} row={row} />
            ))}
          </ul>
        )}
      </Card>

      {manual.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-1 font-semibold">Criadas antes da conexão</h2>
          <p className="mb-1 text-sm text-muted">
            Contas criadas à mão, sem ligação com o banco. Arquive as que não usa
            mais. O histórico de lançamentos é mantido.
          </p>
          <ul className="divide-y divide-line">
            {manual.map((row) => (
              <AccountItem key={row.id} row={row} />
            ))}
          </ul>
        </Card>
      )}

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

function AccountItem({ row }: { row: AccountRow }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
        <BankIcon institution={row} fallbackName={row.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.name}</p>
          <p className="text-xs text-muted">
            {row.institution_name ?? ACCOUNT_KINDS[row.kind]}
          </p>
        </div>
      </div>
      <p className="whitespace-nowrap text-sm font-semibold tabular-nums">
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
