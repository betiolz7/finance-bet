import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import {
  Card,
  EmptyState,
  Field,
  PageHeader,
  inputClass,
  secondaryButtonClass,
  textButtonClass,
} from "@/components/ui";
import { addDays, formatDate, todayInBrazil } from "@/lib/dates";
import {
  getItem,
  isPluggyConfigured,
  listAccounts,
  pluggyItemIds,
  type PluggyAccount,
  type PluggyItem,
} from "@/lib/pluggy";
import { requireDb } from "@/lib/supabase/server";
import { loadActiveCards, loadFormOptions } from "../lancamentos/queries";
import type { Option } from "../lancamentos/transaction-form";
import { saveBankLink, syncBank } from "./actions";
import { ConnectBank } from "./connect-bank";

const CONSENT_WARNING_DAYS = 30;

const ITEM_STATUS: Record<string, string> = {
  UPDATED: "Atualizado",
  UPDATING: "Atualizando",
  OUTDATED: "Desatualizado",
  LOGIN_ERROR: "Erro de login",
  WAITING_USER_INPUT: "Aguardando ação sua",
};

interface BankLink {
  pluggy_account_id: string;
  account_id: string | null;
  card_id: string | null;
  import_from: string;
}

async function loadConnections(itemIds: string[]) {
  try {
    const items = await Promise.all(itemIds.map(getItem));
    const accounts = (await Promise.all(itemIds.map(listAccounts))).flat();
    return { items, accounts, failed: false };
  } catch {
    return { items: [] as PluggyItem[], accounts: [] as PluggyAccount[], failed: true };
  }
}

function brazilDate(iso: string): string {
  return formatDate(todayInBrazil(new Date(iso)));
}

export default async function OpenFinancePage() {
  const db = await requireDb();
  const today = todayInBrazil();

  if (!isPluggyConfigured()) {
    return (
      <>
        <PageHeader title="Open Finance" />
        <Card>
          <p className="text-sm">
            A conexão ainda não foi configurada. Preencha PLUGGY_CLIENT_ID e
            PLUGGY_CLIENT_SECRET no arquivo .env.local e reinicie o servidor.
          </p>
        </Card>
      </>
    );
  }

  const storedItems = await db.from("bank_items").select("item_id");
  if (storedItems.error) throw new Error(storedItems.error.message);
  const itemIds = [
    ...new Set([
      ...pluggyItemIds(),
      ...(storedItems.data as { item_id: string }[]).map((row) => row.item_id),
    ]),
  ];

  const [connections, links, pending, options, cards] = await Promise.all([
    loadConnections(itemIds),
    db.from("bank_links").select("pluggy_account_id, account_id, card_id, import_from"),
    db
      .from("bank_transactions")
      .select("id", { count: "exact", head: true })
      .eq("state", "new"),
    loadFormOptions(),
    loadActiveCards(),
  ]);
  if (links.error) throw new Error(links.error.message);

  const linkByAccount = new Map(
    (links.data as BankLink[]).map((link) => [link.pluggy_account_id, link]),
  );
  const pendingCount = pending.count ?? 0;
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  return (
    <>
      <PageHeader
        title="Open Finance"
        action={
          pendingCount > 0 ? (
            <Link href="/open-finance/revisar" className={secondaryButtonClass}>
              Revisar {pendingCount}
            </Link>
          ) : undefined
        }
      />

      {connections.failed && (
        <Card className="mb-4">
          <p role="alert" className="text-sm text-expense">
            Não foi possível falar com a Pluggy. Confira as credenciais e os IDs no
            arquivo .env.local.
          </p>
        </Card>
      )}

      <Card className="mb-4">
        <h2 className="mb-1 font-semibold">Conectar banco</h2>
        <p className="mb-3 text-sm text-muted">
          Abre a janela segura da Pluggy. Suas senhas não passam pelo app.
        </p>
        <ConnectBank />
      </Card>

      {connections.items.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-1 font-semibold">Conexões</h2>
          <ul className="divide-y divide-line">
            {connections.items.map((item) => {
              const expiring =
                item.consentExpiresAt &&
                todayInBrazil(new Date(item.consentExpiresAt)) <=
                  addDays(today, CONSENT_WARNING_DAYS);
              return (
                <li key={item.id} className="py-3 text-sm">
                  <p className="font-medium">
                    {item.connector?.name ?? "Banco"}:{" "}
                    {ITEM_STATUS[item.status] ?? item.status}
                  </p>
                  <p className="text-xs text-muted">
                    {item.lastUpdatedAt &&
                      `Dados atualizados em ${brazilDate(item.lastUpdatedAt)}. `}
                    O MeuPluggy atualiza uma vez por dia.
                  </p>
                  {item.consentExpiresAt && (
                    <p
                      className={`text-xs ${expiring ? "font-medium text-expense" : "text-muted"}`}
                    >
                      {expiring && "▲ "}Autorização válida até{" "}
                      {brazilDate(item.consentExpiresAt)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="mb-4">
        <h2 className="mb-1 font-semibold">Contas do banco</h2>
        <p className="mb-2 text-sm text-muted">
          Escolha onde cada conta deve cair no app. A data inicial evita trazer de
          volta o que você já lançou à mão.
        </p>
        {connections.accounts.length === 0 ? (
          <EmptyState message="Nenhuma conta encontrada." />
        ) : (
          <ul className="divide-y divide-line">
            {connections.accounts.map((account) => (
              <AccountLink
                key={account.id}
                account={account}
                link={linkByAccount.get(account.id)}
                options={account.type === "CREDIT" ? cards : options.accounts}
                defaultFrom={firstOfMonth}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <ActionForm
          action={syncBank}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-muted">
            Nada é lançado sem a sua revisão.
          </p>
          <SubmitButton>Buscar transações</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}

function AccountLink({
  account,
  link,
  options,
  defaultFrom,
}: {
  account: PluggyAccount;
  link?: BankLink;
  options: Option[];
  defaultFrom: string;
}) {
  const isCard = account.type === "CREDIT";
  const current = link?.card_id ?? link?.account_id ?? "";

  return (
    <li className="py-3">
      <p className="truncate text-sm font-medium">
        {account.marketingName ?? account.name}
      </p>
      <p className="mb-2 text-xs text-muted">
        {isCard ? "Cartão de crédito" : "Conta"}
        {account.number && ` · final ${account.number.slice(-4)}`}
      </p>
      {options.length === 0 ? (
        <Link href={isCard ? "/cartoes" : "/contas"} className={textButtonClass}>
          {isCard ? "Cadastre um cartão no app" : "Cadastre uma conta no app"}
        </Link>
      ) : (
        <ActionForm
          action={saveBankLink.bind(null, account.id, account.type)}
          className="grid items-end gap-3 sm:grid-cols-[1fr_11rem_auto]"
        >
          <Field label={isCard ? "Cartão no app" : "Conta no app"}>
            <select name="destination" defaultValue={current} className={inputClass}>
              <option value="">Não sincronizar</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Buscar a partir de">
            <input
              name="importFrom"
              type="date"
              defaultValue={link?.import_from ?? defaultFrom}
              className={inputClass}
            />
          </Field>
          <SubmitButton>Salvar</SubmitButton>
        </ActionForm>
      )}
    </li>
  );
}
