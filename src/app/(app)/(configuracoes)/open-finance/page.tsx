import Link from "next/link";
import { BankIcon, type Institution } from "@/components/bank-icon";
import { ActionForm, SubmitButton } from "@/components/forms";
import {
  Card,
  EmptyState,
  PageHeader,
  inputClass,
  secondaryButtonClass,
  textButtonClass,
} from "@/components/ui";
import { connectedItemIds } from "@/lib/connected-accounts-server";
import { addDays, formatDate, todayInBrazil } from "@/lib/dates";
import {
  getItem,
  isPluggyConfigured,
  listAccounts,
  listBankConnectors,
  type PluggyAccount,
  type PluggyConnector,
  type PluggyItem,
} from "@/lib/pluggy";
import { perItem } from "@/lib/per-item";
import { requireDb } from "@/lib/supabase/server";
import {
  refreshConnectedAccounts,
  setImportFrom,
  setItemBank,
  syncBank,
} from "./actions";
import { ConnectBank } from "./connect-bank";
import { NotificationsCard } from "./notifications-card";

const CONSENT_WARNING_DAYS = 30;

const ITEM_STATUS: Record<string, string> = {
  UPDATED: "Atualizado",
  UPDATING: "Atualizando",
  OUTDATED: "Desatualizado",
  LOGIN_ERROR: "Erro de login",
  WAITING_USER_INPUT: "Aguardando ação sua",
};

interface StoredItem extends Institution {
  item_id: string;
  connector_id: number | null;
}

interface LinkRow {
  id: string;
  pluggy_account_id: string;
  import_from: string;
  account: { name: string } | null;
  card: { name: string } | null;
}

async function loadConnections(itemIds: string[]) {
  const { results, failed } = await perItem(itemIds, async (itemId) => {
    const [item, accounts] = await Promise.all([getItem(itemId), listAccounts(itemId)]);
    return { item, accounts };
  });
  return {
    items: results.map(({ value }) => value.item) as PluggyItem[],
    accounts: results.flatMap(({ value }) => value.accounts) as PluggyAccount[],
    failedCount: failed.length,
    failed: itemIds.length > 0 && results.length === 0,
  };
}

async function loadConnectors(): Promise<PluggyConnector[]> {
  try {
    return await listBankConnectors();
  } catch {
    return [];
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

  const itemIds = await connectedItemIds(db);
  const [connections, connectors, stored, links, pending] = await Promise.all([
    loadConnections(itemIds),
    loadConnectors(),
    db
      .from("bank_items")
      .select("item_id, connector_id, institution_name, institution_logo, institution_color"),
    db
      .from("bank_links")
      .select(
        "id, pluggy_account_id, import_from, account:accounts(name), card:credit_cards(name)",
      ),
    db
      .from("bank_transactions")
      .select("id", { count: "exact", head: true })
      .eq("state", "new"),
  ]);
  if (stored.error) throw new Error(stored.error.message);
  if (links.error) throw new Error(links.error.message);

  const storedById = new Map(
    (stored.data as StoredItem[]).map((item) => [item.item_id, item]),
  );
  const linkByAccount = new Map(
    (links.data as unknown as LinkRow[]).map((link) => [link.pluggy_account_id, link]),
  );
  const missing = connections.accounts.filter((a) => !linkByAccount.has(a.id));
  const pendingCount = pending.count ?? 0;

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

      {connections.failed ? (
        <Card className="mb-4">
          <p role="alert" className="text-sm text-expense">
            Não foi possível falar com a Pluggy. Confira as credenciais e tente de
            novo mais tarde.
          </p>
        </Card>
      ) : (
        connections.failedCount > 0 && (
          <Card className="mb-4">
            <p role="alert" className="text-sm text-expense">
              {connections.failedCount === 1
                ? "Uma conexão não respondeu."
                : `${connections.failedCount} conexões não responderam.`}{" "}
              Ela pode ter sido removida no Meu Pluggy ou estar com a autorização
              vencida. As demais continuam funcionando.
            </p>
          </Card>
        )
      )}

      <Card className="mb-4">
        <h2 className="mb-1 font-semibold">Conectar banco</h2>
        <p className="mb-3 text-sm text-muted">
          Contas e cartões entram no app só por aqui. Suas senhas não passam pelo
          app.
        </p>
        <ConnectBank />
      </Card>

      {connections.items.map((item) => {
        const info = storedById.get(item.id);
        const accounts = connections.accounts.filter((a) => a.itemId === item.id);
        const expiring =
          item.consentExpiresAt &&
          todayInBrazil(new Date(item.consentExpiresAt)) <=
            addDays(today, CONSENT_WARNING_DAYS);

        return (
          <Card key={item.id} className="mb-4">
            <div className="flex flex-wrap items-start gap-4">
              <BankIcon institution={info} fallbackName="Banco" size={48} />
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-semibold">
                  {info?.institution_name ?? "Banco não identificado"}
                </p>
                <p className="text-xs text-muted">
                  {ITEM_STATUS[item.status] ?? item.status}
                  {item.lastUpdatedAt &&
                    ` · Dados de ${brazilDate(item.lastUpdatedAt)}`}
                  {" · Atualiza uma vez por dia"}
                </p>
                {item.consentExpiresAt && (
                  <p
                    className={`text-xs ${expiring ? "font-medium text-expense" : "text-muted"}`}
                  >
                    {expiring && "▲ "}Autorização válida até{" "}
                    {brazilDate(item.consentExpiresAt)}
                  </p>
                )}
              </div>
            </div>

            {connectors.length > 0 && (
              <ActionForm
                action={setItemBank.bind(null, item.id)}
                className="mt-4 flex flex-wrap items-end gap-2"
              >
                <label className="min-w-0 flex-1 basis-56">
                  <span className="mb-1 block text-sm font-medium">
                    Qual banco é esta conexão?
                  </span>
                  <select
                    name="connectorId"
                    required
                    defaultValue={info?.connector_id ?? ""}
                    className={inputClass}
                  >
                    <option value="">Selecione o banco</option>
                    {connectors.map((connector) => (
                      <option key={connector.id} value={connector.id}>
                        {connector.name}
                      </option>
                    ))}
                  </select>
                </label>
                <SubmitButton>Salvar</SubmitButton>
              </ActionForm>
            )}

            <ul className="mt-4 divide-y divide-line border-t border-line">
              {accounts.map((account) => {
                const link = linkByAccount.get(account.id);
                const appName = link?.account?.name ?? link?.card?.name;
                return (
                  <li
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {account.marketingName ?? account.name}
                      </p>
                      <p className="text-xs text-muted">
                        {account.type === "CREDIT" ? "Cartão de crédito" : "Conta"}
                        {account.number && ` · final ${account.number.slice(-4)}`}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium ${appName ? "text-income" : "text-pending"}`}
                    >
                      {appName ? `✓ No app como ${appName}` : "● Ainda não importada"}
                    </span>
                    {link && (
                      <ActionForm
                        action={setImportFrom.bind(null, link.id)}
                        className="flex w-full flex-wrap items-center gap-2 text-xs"
                      >
                        <label htmlFor={`from-${link.id}`} className="text-muted">
                          Buscar transações desde
                        </label>
                        <input
                          id={`from-${link.id}`}
                          name="importFrom"
                          type="date"
                          defaultValue={link.import_from}
                          max={today}
                          className="rounded-lg border border-line bg-surface px-2 py-1"
                        />
                        <SubmitButton className={textButtonClass}>Salvar</SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}

      {connections.items.length > 0 && <NotificationsCard />}

      {missing.length > 0 && (
        <Card className="mb-4">
          <ActionForm
            action={refreshConnectedAccounts}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm">
              {missing.length}{" "}
              {missing.length === 1 ? "conta ainda não foi importada" : "contas ainda não foram importadas"}{" "}
              para o app.
            </p>
            <SubmitButton>Importar contas</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {connections.items.length === 0 && !connections.failed ? (
        <Card>
          <EmptyState message="Nenhum banco conectado ainda." />
        </Card>
      ) : (
        <Card>
          <ActionForm
            action={syncBank}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-muted">
              Contas novas entram com o saldo informado pelo banco. Nada é lançado
              sem a sua revisão.
            </p>
            <SubmitButton>Buscar transações</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <p className="mt-4 text-xs text-muted">
        Os ícones dos bancos são fornecidos pela Pluggy.{" "}
        <Link href="/contas" className={textButtonClass}>
          Ver contas no app
        </Link>
      </p>
    </>
  );
}
