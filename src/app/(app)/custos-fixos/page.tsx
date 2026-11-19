import Link from "next/link";
import { ConfirmButton } from "@/components/forms";
import {
  Card,
  EmptyState,
  PageHeader,
  secondaryButtonClass,
  textButtonClass,
} from "@/components/ui";
import { formatMonth, todayInBrazil } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { summarizeFixedCosts, type RecurringType } from "@/lib/recurring";
import { ensureRecurringGenerated } from "@/lib/recurring-server";
import { requireDb } from "@/lib/supabase/server";
import { setTransactionStatus } from "../lancamentos/actions";
import {
  deleteRecurringRule,
  pauseRecurringRule,
  resumeRecurringRule,
} from "./actions";

interface Rule {
  id: string;
  type: RecurringType;
  description: string;
  amount_cents: number;
  due_day: number;
  active: boolean;
  category: { name: string; color: string };
  account: { id: string; name: string };
}

interface MonthEntry {
  id: string;
  recurring_rule_id: string;
  status: "pending" | "paid";
  amount_cents: number;
}

const TEXT: Record<
  RecurringType,
  {
    title: string;
    noun: string;
    newLabel: string;
    empty: string;
    done: string;
    left: string;
    markDone: string;
    tone: string;
    sign: string;
  }
> = {
  income: {
    title: "Receitas fixas",
    noun: "a receita fixa",
    newLabel: "+ Nova receita fixa",
    empty: "Cadastre salário, aluguel recebido e outras entradas que se repetem todo mês.",
    done: "Recebido",
    left: "falta receber",
    markDone: "Marcar recebido",
    tone: "text-income",
    sign: "+ ",
  },
  expense: {
    title: "Gastos fixos",
    noun: "o gasto fixo",
    newLabel: "+ Novo gasto fixo",
    empty: "Cadastre aluguel, internet, assinaturas e outros gastos que se repetem todo mês.",
    done: "Pago",
    left: "falta pagar",
    markDone: "Marcar pago",
    tone: "text-expense",
    sign: "- ",
  },
};

export default async function FixedPage() {
  const db = await requireDb();
  await ensureRecurringGenerated();

  const month = todayInBrazil().slice(0, 7);
  const [rules, entries] = await Promise.all([
    db
      .from("recurring_rules")
      .select(
        `id, type, description, amount_cents, due_day, active,
         category:categories(name, color),
         account:accounts(id, name)`,
      )
      .order("due_day"),
    db
      .from("transactions")
      .select("id, recurring_rule_id, status, amount_cents")
      .eq("recurring_month", `${month}-01`)
      .not("recurring_rule_id", "is", null),
  ]);
  if (rules.error) throw new Error(rules.error.message);
  if (entries.error) throw new Error(entries.error.message);

  const allRules = rules.data as unknown as Rule[];
  const paused = allRules.filter((rule) => !rule.active);
  const entryByRule = new Map(
    (entries.data as MonthEntry[]).map((entry) => [entry.recurring_rule_id, entry]),
  );
  const activeOf = (type: RecurringType) =>
    allRules.filter((rule) => rule.active && rule.type === type);
  const monthlyTotal = (type: RecurringType) =>
    activeOf(type).reduce(
      (sum, rule) => sum + (entryByRule.get(rule.id)?.amount_cents ?? rule.amount_cents),
      0,
    );
  const incomeTotal = monthlyTotal("income");
  const expenseTotal = monthlyTotal("expense");

  return (
    <>
      <PageHeader
        title="Fixos"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/custos-fixos/novo?tipo=receita" className={secondaryButtonClass}>
              Nova receita fixa
            </Link>
            <Link href="/custos-fixos/novo" className={secondaryButtonClass}>
              Novo gasto fixo
            </Link>
          </div>
        }
      />
      <p className="-mt-2 mb-4 text-sm text-muted">
        O que você já sabe que vai receber e pagar todo mês. Em {formatMonth(month)},
        cada item vira um lançamento pendente na conta escolhida.
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Summary label="Receitas fixas" value={incomeTotal} tone="text-income" />
        <Summary label="Gastos fixos" value={expenseTotal} tone="text-expense" />
        <Summary label="Sobra prevista" value={incomeTotal - expenseTotal} />
      </div>

      {(["income", "expense"] as const).map((type) => (
        <Section
          key={type}
          type={type}
          rules={activeOf(type)}
          entryByRule={entryByRule}
        />
      ))}

      {paused.length > 0 && (
        <Card>
          <h2 className="mb-1 font-semibold">Pausados</h2>
          <ul className="divide-y divide-line">
            {paused.map((rule) => (
              <RuleItem key={rule.id} rule={rule} />
            ))}
          </ul>
        </Card>
      )}
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

function Section({
  type,
  rules,
  entryByRule,
}: {
  type: RecurringType;
  rules: Rule[];
  entryByRule: Map<string, MonthEntry>;
}) {
  const text = TEXT[type];
  const entries = rules.flatMap((rule) => entryByRule.get(rule.id) ?? []);
  const summary = summarizeFixedCosts(entries);

  return (
    <Card className="mb-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="font-semibold">{text.title}</h2>
          {rules.length > 0 && (
            <p className="text-xs text-muted tabular-nums">
              {text.done} {formatCents(summary.paidCents)} · {text.left}{" "}
              {formatCents(summary.pendingCents)}
            </p>
          )}
        </div>
        <Link
          href={type === "income" ? "/custos-fixos/novo?tipo=receita" : "/custos-fixos/novo"}
          className={textButtonClass}
        >
          {text.newLabel}
        </Link>
      </div>
      {rules.length === 0 ? (
        <EmptyState
          message={text.empty}
          href={type === "income" ? "/custos-fixos/novo?tipo=receita" : "/custos-fixos/novo"}
          linkLabel={text.newLabel.slice(2)}
        />
      ) : (
        <ul className="divide-y divide-line">
          {rules.map((rule) => (
            <RuleItem key={rule.id} rule={rule} entry={entryByRule.get(rule.id)} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function RuleItem({ rule, entry }: { rule: Rule; entry?: MonthEntry }) {
  const text = TEXT[rule.type];
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate text-sm font-medium">{rule.description}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>Dia {rule.due_day}</span>
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: rule.category.color }}
            />
            {rule.category.name}
          </span>
          <Link href={`/contas/${rule.account.id}`} className="hover:text-ink hover:underline">
            {rule.account.name}
          </Link>
          {entry?.status === "pending" && (
            <span className="rounded bg-pending-soft px-1.5 py-0.5 font-medium text-pending">
              Pendente
            </span>
          )}
          {entry?.status === "paid" && (
            <span className="rounded bg-brand-soft px-1.5 py-0.5 font-medium text-income">
              {text.done}
            </span>
          )}
        </p>
      </div>

      <p className={`text-sm font-semibold tabular-nums ${text.tone}`}>
        {text.sign}
        {formatCents(entry?.amount_cents ?? rule.amount_cents)}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {entry?.status === "pending" && (
          <form action={setTransactionStatus.bind(null, entry.id, "paid")}>
            <button type="submit" className={textButtonClass}>
              {text.markDone}
            </button>
          </form>
        )}
        {entry && (
          <Link href={`/lancamentos/${entry.id}/editar`} className={textButtonClass}>
            Ajustar mês
          </Link>
        )}
        <Link href={`/custos-fixos/${rule.id}/editar`} className={textButtonClass}>
          Editar
        </Link>
        <form
          action={(rule.active ? pauseRecurringRule : resumeRecurringRule).bind(
            null,
            rule.id,
          )}
        >
          <button type="submit" className={textButtonClass}>
            {rule.active ? "Pausar" : "Reativar"}
          </button>
        </form>
        <form action={deleteRecurringRule.bind(null, rule.id)}>
          <ConfirmButton
            message={`Apagar ${text.noun} "${rule.description}"? Os lançamentos já criados serão mantidos.`}
            className={textButtonClass}
          >
            Apagar
          </ConfirmButton>
        </form>
      </div>
    </li>
  );
}
