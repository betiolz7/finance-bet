import Link from "next/link";
import { ConfirmButton } from "@/components/forms";
import {
  Card,
  EmptyState,
  PageHeader,
  primaryButtonClass,
  textButtonClass,
} from "@/components/ui";
import { formatMonth, todayInBrazil } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { summarizeFixedCosts } from "@/lib/recurring";
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
  description: string;
  amount_cents: number;
  due_day: number;
  active: boolean;
  category: { name: string; color: string };
  account: { name: string };
}

interface MonthEntry {
  id: string;
  recurring_rule_id: string;
  status: "pending" | "paid";
  amount_cents: number;
}

export default async function FixedCostsPage() {
  const db = await requireDb();
  await ensureRecurringGenerated();

  const month = todayInBrazil().slice(0, 7);
  const [rules, entries] = await Promise.all([
    db
      .from("recurring_rules")
      .select(
        `id, description, amount_cents, due_day, active,
         category:categories(name, color),
         account:accounts(name)`,
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
  const active = allRules.filter((rule) => rule.active);
  const paused = allRules.filter((rule) => !rule.active);
  const monthEntries = entries.data as MonthEntry[];
  const entryByRule = new Map(
    monthEntries.map((entry) => [entry.recurring_rule_id, entry]),
  );
  const summary = summarizeFixedCosts(monthEntries);
  const monthlyTotal = active.reduce((sum, rule) => sum + rule.amount_cents, 0);

  return (
    <>
      <PageHeader
        title="Custos fixos"
        action={
          <Link href="/custos-fixos/novo" className={primaryButtonClass}>
            Novo custo fixo
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Summary label="Total mensal" value={monthlyTotal} />
        <Summary label={`Pago em ${formatMonth(month)}`} value={summary.paidCents} />
        <Summary label="Ainda a pagar" value={summary.pendingCents} />
      </div>

      <Card className="mb-4">
        {active.length === 0 ? (
          <EmptyState
            message="Cadastre aluguel, internet, assinaturas e outros custos que se repetem todo mês."
            href="/custos-fixos/novo"
            linkLabel="Cadastrar custo fixo"
          />
        ) : (
          <ul className="divide-y divide-line">
            {active.map((rule) => (
              <RuleItem key={rule.id} rule={rule} entry={entryByRule.get(rule.id)} />
            ))}
          </ul>
        )}
      </Card>

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

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {formatCents(value)}
      </p>
    </Card>
  );
}

function RuleItem({ rule, entry }: { rule: Rule; entry?: MonthEntry }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate text-sm font-medium">{rule.description}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>Vence dia {rule.due_day}</span>
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: rule.category.color }}
            />
            {rule.category.name}
          </span>
          <span>{rule.account.name}</span>
          {entry?.status === "pending" && (
            <span className="rounded bg-pending-soft px-1.5 py-0.5 font-medium text-pending">
              Pendente
            </span>
          )}
          {entry?.status === "paid" && (
            <span className="rounded bg-brand-soft px-1.5 py-0.5 font-medium text-income">
              Pago
            </span>
          )}
        </p>
      </div>

      <p className="text-sm font-semibold tabular-nums">
        {formatCents(entry?.amount_cents ?? rule.amount_cents)}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {entry?.status === "pending" && (
          <form action={setTransactionStatus.bind(null, entry.id, "paid")}>
            <button type="submit" className={textButtonClass}>
              Marcar pago
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
            message={`Apagar o custo fixo "${rule.description}"? Os lançamentos já criados serão mantidos.`}
            className={textButtonClass}
          >
            Apagar
          </ConfirmButton>
        </form>
      </div>
    </li>
  );
}
