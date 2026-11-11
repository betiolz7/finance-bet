// Cliente da API da Pluggy. Usar apenas no servidor: as credenciais não têm o
// prefixo NEXT_PUBLIC justamente para nunca chegarem ao navegador.

const BASE_URL = "https://api.pluggy.ai";
// A chave dura 2 horas. Renovar antes evita falha no meio de uma sincronização.
const API_KEY_TTL_MS = 110 * 60 * 1000;
const MAX_TRANSACTION_PAGES = 50;

export class PluggyError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PluggyError";
  }
}

export interface PluggyItem {
  id: string;
  status: string;
  lastUpdatedAt: string | null;
  nextAutoSyncAt?: string | null;
  consentExpiresAt?: string | null;
  connector?: { name?: string } | null;
}

export interface PluggyAccount {
  id: string;
  type: "BANK" | "CREDIT" | string;
  subtype?: string | null;
  name: string;
  marketingName?: string | null;
  number?: string | null;
  balance?: number | null;
  itemId: string;
  creditData?: {
    balanceCloseDate?: string | null;
    balanceDueDate?: string | null;
    creditLimit?: number | null;
  } | null;
}

export interface PluggyConnector {
  id: number;
  name: string;
  imageUrl?: string | null;
  primaryColor?: string | null;
  isSandbox?: boolean;
}

/** Id do conector MeuPluggy, que não identifica o banco de origem. */
export const MEU_PLUGGY_CONNECTOR_ID = 200;

export async function listBankConnectors(): Promise<PluggyConnector[]> {
  const params = new URLSearchParams({ countries: "BR", types: "PERSONAL_BANK" });
  const { results } = await get<{ results: PluggyConnector[] }>(`/connectors?${params}`);
  const seen = new Set<string>();
  return results
    .filter((c) => !c.isSandbox && c.id !== MEU_PLUGGY_CONNECTOR_ID)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .filter((c) => {
      const key = c.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function getConnector(id: number): Promise<PluggyConnector> {
  return get<PluggyConnector>(`/connectors/${id}`);
}

export interface PluggyTransaction {
  id: string;
  description: string;
  amount: number;
  amountInAccountCurrency?: number | null;
  date: string;
  type: "DEBIT" | "CREDIT" | string;
  status?: string | null;
  category?: string | null;
  createdAt?: string | null;
  creditCardMetadata?: {
    installmentNumber?: number | null;
    totalInstallments?: number | null;
  } | null;
}

export interface PluggyInvestment {
  id: string;
  itemId: string;
  name: string;
  type: string;
  subtype?: string | null;
  currencyCode: string;
  balance: number;
  amountOriginal?: number | null;
  amountProfit?: number | null;
  rateType?: string | null;
  dueDate?: string | null;
  issuer?: string | null;
  status?: string | null;
  institution?: { name?: string | null } | null;
}

export function pluggyItemIds(): string[] {
  return (process.env.PLUGGY_ITEM_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isPluggyConfigured(): boolean {
  return Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

let cachedKey: { value: string; expiresAt: number } | null = null;

export function resetPluggyAuth() {
  cachedKey = null;
}

async function apiKey(): Promise<string> {
  if (cachedKey && cachedKey.expiresAt > Date.now()) return cachedKey.value;

  const response = await fetch(`${BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new PluggyError("A Pluggy recusou as credenciais.", response.status);
  }

  const { apiKey: value } = (await response.json()) as { apiKey: string };
  cachedKey = { value, expiresAt: Date.now() + API_KEY_TTL_MS };
  return value;
}

async function get<T>(path: string, retried = false): Promise<T> {
  const response = await fetch(new URL(path, BASE_URL), {
    headers: { "X-API-KEY": await apiKey() },
    cache: "no-store",
  });

  if (response.status === 401 && !retried) {
    resetPluggyAuth();
    return get<T>(path, true);
  }
  if (!response.ok) {
    throw new PluggyError("A Pluggy não respondeu como esperado.", response.status);
  }
  return (await response.json()) as T;
}

export function getItem(itemId: string): Promise<PluggyItem> {
  return get<PluggyItem>(`/items/${encodeURIComponent(itemId)}`);
}

export async function listAccounts(itemId: string): Promise<PluggyAccount[]> {
  const params = new URLSearchParams({ itemId });
  const { results } = await get<{ results: PluggyAccount[] }>(`/accounts?${params}`);
  return results;
}

export async function listInvestments(itemId: string): Promise<PluggyInvestment[]> {
  const all: PluggyInvestment[] = [];
  for (let page = 1; ; page++) {
    if (page > MAX_TRANSACTION_PAGES) {
      throw new PluggyError("A Pluggy devolveu páginas demais.");
    }
    const params = new URLSearchParams({ itemId, page: String(page) });
    const body: { results: PluggyInvestment[]; totalPages?: number } = await get(
      `/investments?${params}`,
    );
    all.push(...body.results);
    if (!body.totalPages || page >= body.totalPages) return all;
  }
}

export async function getAccount(id: string): Promise<PluggyAccount> {
  return get<PluggyAccount>(`/accounts/${encodeURIComponent(id)}`);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(new URL(path, BASE_URL), {
    method: "POST",
    headers: { "X-API-KEY": await apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new PluggyError("A Pluggy não respondeu como esperado.", response.status);
  }
  return (await response.json()) as T;
}

export interface PluggyWebhook {
  id: string;
  url: string;
  event: string;
}

export async function listWebhooks(): Promise<PluggyWebhook[]> {
  const body = await get<{ results?: PluggyWebhook[] } | PluggyWebhook[]>("/webhooks");
  return Array.isArray(body) ? body : (body.results ?? []);
}

export function createWebhook(webhook: {
  url: string;
  event: string;
  headers: Record<string, string>;
}): Promise<PluggyWebhook> {
  return post<PluggyWebhook>("/webhooks", webhook);
}

/** Com createdAtFrom, traz só o que a Pluggy recebeu a partir desse momento. */
export async function listTransactions(
  accountId: string,
  dateFrom: string,
  createdAtFrom?: string,
): Promise<PluggyTransaction[]> {
  const params = new URLSearchParams({ accountId, dateFrom });
  if (createdAtFrom) params.set("createdAtFrom", createdAtFrom);
  const all: PluggyTransaction[] = [];
  let query: string | null = `?${params}`;

  for (let page = 0; query; page++) {
    if (page >= MAX_TRANSACTION_PAGES) {
      throw new PluggyError("A Pluggy devolveu páginas demais.");
    }
    const body: { results: PluggyTransaction[]; next?: string | null } = await get(
      `/v2/transactions${query}`,
    );
    all.push(...body.results);
    query = body.next ?? null;
  }
  return all;
}
