import Link from "next/link";
import { notFound } from "next/navigation";
import { BankIcon, type Institution } from "@/components/bank-icon";
import { MonthNav } from "@/components/month-nav";
import {
  Card,
  EmptyState,
  PageHeader,
  textButtonClass,
} from "@/components/ui";
import {
  formatDate,
  formatMonth,
  isValidMonth,
  monthBounds,
  todayInBrazil,
} from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { RecurringType } from "@/lib/recurring";
import { ensureRecurringGenerated } from "@/lib/recurring-server";
import { requireDb } from "@/lib/supabase/server";
import { summarizeAccountMonth } from "@/lib/transactions";
import {
  LISTED_TRANSACTION_SELECT,
  TransactionItem,
  type ListedTransaction,
} from "../../lancamentos/transaction-item";
import { ACCOUNT_KINDS } from "../account-fields";

interface AccountDetail extends Institution {
  id: string;
  name: string;
  kind: string;
  archived: boolean;
}

interface FixedRule {
  id: string;
  type: RecurringType;
  description: string;
  amount_cents: number;
  due_day: number;
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const [{ id }, { mes }] = await Promise.all([params, searchParams]);
  const db = await requireDb();
  await ensureRecurringGenerated();

  const { data: account } = await db
    .from("accounts")
    .select("id, name, kind, archived, institution_name, institution_logo, institution_color")
    .eq("id", id)
    .maybeSingle<AccountDetail>();
  if (!account) notFound();

  const month = mes && isValidMonth(mes) ? mes : todayInBrazil().slice(0, 7);
  const { start, end } = monthBounds(month);

  const [balance, transactions, rules] = await Promise.all([
    db
      .from("account_balances")
      .select("balance_cents, ledger_balance_cents, bank_balance_at")
      .eq("id", account.id)
      .single(),
    db
      .from("transactions")
      .select(LISTED_TRANSACTION_SELECT)
      .or(`account_id.eq.${account.id},to_account_id.eq.${account.id}`)
      .gte("date", start)
      .lt("date", end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    db
      .from("recurring_rules")
      .select("id, type, description, amount_cents, due_day")
      .eq("account_id", account.id)
      .eq("active", true)
      .order("due_day"),
  ]);
  if (balance.error) throw new Error(balance.error.message);
  if (transactions.error) throw new Error(transactions.error.message);
  if (rules.error) throw new Error(rules.error.message);

  const rows = transactions.data as unknown as ListedTransaction[];
  const summary = summarizeAccountMonth(rows, account.id);
  const fixed = rules.data as FixedRule[];
  const bankBalanceAt = balance.data.bank_balance_at as string | null;

  return (
    <>
      <PageHeader
        title={account.name}
        action={<MonthNav basePath={`/contas/${account.id}`} month={month} />}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BankIcon institution={account} fallbackName={account.name} />
            <div>
              <p className="text-sm text-muted">
                Saldo hoje · {account.institution_name ?? ACCOUNT_KINDS[account.kind]}
                {account.archived && " · arquivada"}
              </p>
              <p className="whitespace-nowrap text-3xl font-semibold tracking-tight tabular-nums">
                {formatCents(balance.data.balance_cents)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/contas" className={textButtonClass}>
              Todas as contas
            </Link>
            <Link href={`/contas/${account.id}/editar`} className={textButtonClass}>
              Editar
            </Link>
          </div>
        </div>
        {bankBalanceAt && (
          <p className="mt-2 text-xs text-muted">
            Saldo do banco em {formatDate(todayInBrazil(new Date(bankBalanceAt)))}
            {balance.data.ledger_balance_cents !== balance.data.balance_cents &&
              ` · lançamentos no app somam ${formatCents(balance.data.ledger_balance_cents)}`}
          </p>
        )}
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Summary label={`Entrou em ${formatMonth(month)}`} value={summary.inCents} tone="text-income" />
        <Summary label="Saiu" value={summary.outCents} tone="text-expense" />
        <Summary label="Resultado do mês" value={summary.netCents} />
      </div>

      {fixed.length > 0 && (
        <Card className="mb-4">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h2 className="font-semibold">Fixos desta conta</h2>
            <Link href="/custos-fixos" className={textButtonClass}>
              Ver todos os fixos
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {fixed.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{rule.description}</p>
                  <p className="text-xs text-muted">
                    {rule.type === "income" ? "Receita" : "Gasto"} · dia {rule.due_day}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    rule.type === "income" ? "text-income" : "text-expense"
                  }`}
                >
                  {rule.type === "income" ? "+ " : "- "}
                  {formatCents(rule.amount_cents)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-1 font-semibold">Lançamentos</h2>
        {rows.length === 0 ? (
          <EmptyState
            message="Nenhum lançamento nesta conta neste mês."
            href="/lancamentos/novo"
            linkLabel="Criar lançamento"
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <TransactionItem key={row.id} row={row} accountId={account.id} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Summary({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums ${tone}`}>
        {formatCents(value)}
      </p>
    </Card>
  );
}
