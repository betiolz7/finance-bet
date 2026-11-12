import type { SupabaseClient } from "@supabase/supabase-js";
import {
  budgetLevel,
  effectiveBudgets,
  projectMonthEnd,
  spendingByCategory,
  upcomingBills,
  type BudgetRow,
} from "../dashboard";
import { addDays, formatDate, formatMonth, monthBounds, shiftMonth } from "../dates";
import { countGoalsByAccount, goalProgress } from "../goals";
import { normalizeName } from "../import";
import { formatCents } from "../money";
import { summarizeMonth } from "../transactions";
import {
  SUGGESTIONS,
  monthPeriod,
  parseQuestion,
  type ParsedQuestion,
  type Period,
} from "./parse";
import { detectRecurring } from "./recurring";

export interface AnswerRow {
  label: string;
  detail?: string;
  cents?: number;
  text?: string;
  tone?: "income" | "expense" | "neutral" | "warning";
}

export interface AssistantAnswer {
  title: string;
  summary: string;
  rows: AnswerRow[];
  link?: { label: string; href: string };
  suggestions?: string[];
}

interface TxRow {
  type: string;
  status: string;
  amount_cents: number;
  date: string;
  description: string;
  category_id: string | null;
}

const MAX_ROWS = 8;

async function loadTransactions(db: SupabaseClient, period: Period): Promise<TxRow[]> {
  const { data, error } = await db
    .from("transactions")
    .select("type, status, amount_cents, date, description, category_id")
    .in("type", ["income", "expense"])
    .gte("date", period.start)
    .lt("date", period.end)
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return data as TxRow[];
}

async function loadCategories(db: SupabaseClient) {
  const { data, error } = await db.from("categories").select("id, name, kind");
  if (error) throw new Error(error.message);
  return data as { id: string; name: string; kind: string }[];
}

function linkFor(period: Period) {
  return period.month
    ? { label: "Ver lançamentos do mês", href: `/lancamentos?mes=${period.month}` }
    : { label: "Ver lançamentos", href: "/lancamentos" };
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export async function answerQuestion(
  db: SupabaseClient,
  question: string,
  today: string,
): Promise<AssistantAnswer> {
  const parsed = parseQuestion(question, today);
  return answerParsed(db, parsed, today);
}

async function answerParsed(
  db: SupabaseClient,
  { intent, period, term }: ParsedQuestion,
  today: string,
): Promise<AssistantAnswer> {
  switch (intent) {
    case "spent_on": {
      const [rows, categories] = await Promise.all([
        loadTransactions(db, period),
        loadCategories(db),
      ]);
      const wanted = normalizeName(term ?? "");
      const category = categories.find(
        (c) => c.kind === "expense" && normalizeName(c.name) === wanted,
      );
      const matches = rows.filter(
        (row) =>
          row.type === "expense" &&
          (category
            ? row.category_id === category.id
            : normalizeName(row.description).includes(wanted)),
      );
      const total = matches.reduce((sum, row) => sum + row.amount_cents, 0);
      const target = category ? `na categoria ${category.name}` : `com "${term}"`;
      return {
        title: `Gastos ${target}`,
        summary:
          matches.length === 0
            ? `Não encontrei gastos ${target} em ${period.label}.`
            : `Você gastou ${formatCents(total)} ${target} em ${period.label}, em ${plural(matches.length, "lançamento", "lançamentos")}.`,
        rows: matches.slice(0, MAX_ROWS).map((row) => ({
          label: row.description,
          detail: formatDate(row.date),
          cents: row.amount_cents,
          tone: "expense",
        })),
        link: linkFor(period),
      };
    }

    case "spent_total":
    case "by_category": {
      const [rows, categories] = await Promise.all([
        loadTransactions(db, period),
        loadCategories(db),
      ]);
      const summary = summarizeMonth(rows);
      const spending = spendingByCategory(rows);
      const names = new Map(categories.map((c) => [c.id, c.name]));
      const ranked = [...spending.entries()].sort((a, b) => b[1] - a[1]);
      return {
        title: `Gastos em ${period.label}`,
        summary:
          summary.expenseCents === 0
            ? `Nenhum gasto em ${period.label}.`
            : `Você gastou ${formatCents(summary.expenseCents)} em ${period.label}. ${
                ranked[0] ? `A maior categoria foi ${names.get(ranked[0][0]) ?? "sem nome"}.` : ""
              }`,
        rows: ranked.slice(0, MAX_ROWS).map(([id, cents]) => ({
          label: names.get(id) ?? "Sem categoria",
          detail: `${Math.round((cents / summary.expenseCents) * 100)}% dos gastos`,
          cents,
          tone: "expense",
        })),
        link: linkFor(period),
      };
    }

    case "top_expenses": {
      const rows = (await loadTransactions(db, period))
        .filter((row) => row.type === "expense")
        .sort((a, b) => b.amount_cents - a.amount_cents);
      return {
        title: `Maiores gastos em ${period.label}`,
        summary:
          rows.length === 0
            ? `Nenhum gasto em ${period.label}.`
            : `O maior foi ${rows[0].description}, de ${formatCents(rows[0].amount_cents)}.`,
        rows: rows.slice(0, MAX_ROWS).map((row) => ({
          label: row.description,
          detail: formatDate(row.date),
          cents: row.amount_cents,
          tone: "expense",
        })),
        link: linkFor(period),
      };
    }

    case "income": {
      const rows = (await loadTransactions(db, period)).filter((row) => row.type === "income");
      const total = rows.reduce((sum, row) => sum + row.amount_cents, 0);
      return {
        title: `Entradas em ${period.label}`,
        summary:
          rows.length === 0
            ? `Nenhuma entrada lançada em ${period.label}.`
            : `Entraram ${formatCents(total)} em ${period.label}, em ${plural(rows.length, "lançamento", "lançamentos")}.`,
        rows: rows.slice(0, MAX_ROWS).map((row) => ({
          label: row.description,
          detail: formatDate(row.date),
          cents: row.amount_cents,
          tone: "income",
        })),
        link: linkFor(period),
      };
    }

    case "compare": {
      const month = period.month ?? today.slice(0, 7);
      const current = monthPeriod(month);
      const previous = monthPeriod(shiftMonth(month, -1));
      const [nowRows, beforeRows, categories] = await Promise.all([
        loadTransactions(db, current),
        loadTransactions(db, previous),
        loadCategories(db),
      ]);
      const now = summarizeMonth(nowRows);
      const before = summarizeMonth(beforeRows);
      const names = new Map(categories.map((c) => [c.id, c.name]));
      const nowByCategory = spendingByCategory(nowRows);
      const beforeByCategory = spendingByCategory(beforeRows);
      const increases = [...nowByCategory.entries()]
        .map(([id, cents]) => ({ id, delta: cents - (beforeByCategory.get(id) ?? 0) }))
        .filter((item) => item.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 3);
      const diff = now.expenseCents - before.expenseCents;

      return {
        title: `${formatMonth(month)} comparado a ${formatMonth(shiftMonth(month, -1))}`,
        summary:
          diff === 0
            ? "Você gastou o mesmo valor nos dois meses."
            : `Você gastou ${formatCents(Math.abs(diff))} a ${diff > 0 ? "mais" : "menos"} que no mês anterior.`,
        rows: [
          { label: "Receitas", text: `${formatCents(before.incomeCents)} → ${formatCents(now.incomeCents)}` },
          { label: "Despesas", text: `${formatCents(before.expenseCents)} → ${formatCents(now.expenseCents)}` },
          {
            label: "Sobra",
            text: `${formatCents(before.balanceCents)} → ${formatCents(now.balanceCents)}`,
            tone: now.balanceCents < before.balanceCents ? "warning" : "income",
          },
          ...increases.map((item) => ({
            label: `Aumentou: ${names.get(item.id) ?? "Sem categoria"}`,
            cents: item.delta,
            tone: "expense" as const,
          })),
        ],
        link: { label: "Ver Dashboard", href: `/dashboard?mes=${month}` },
      };
    }

    case "recurring": {
      const since = `${shiftMonth(today.slice(0, 7), -3)}-01`;
      const [rules, recent] = await Promise.all([
        db
          .from("recurring_rules")
          .select("description, amount_cents, due_day")
          .eq("active", true)
          .order("amount_cents", { ascending: false }),
        loadTransactions(db, { start: since, end: addDays(today, 1), label: "" }),
      ]);
      if (rules.error) throw new Error(rules.error.message);
      const ruleRows = rules.data as { description: string; amount_cents: number; due_day: number }[];
      const ruleNames = new Set(ruleRows.map((r) => normalizeName(r.description)));
      const detected = detectRecurring(recent.filter((r) => r.type === "expense")).filter(
        (item) => !ruleNames.has(normalizeName(item.description)),
      );
      const total =
        ruleRows.reduce((sum, r) => sum + r.amount_cents, 0) +
        detected.reduce((sum, r) => sum + r.averageCents, 0);

      return {
        title: "Gastos que se repetem todo mês",
        summary:
          ruleRows.length + detected.length === 0
            ? "Não encontrei gastos recorrentes nos últimos meses."
            : `Somam cerca de ${formatCents(total)} por mês: ${plural(ruleRows.length, "custo fixo cadastrado", "custos fixos cadastrados")} e ${plural(detected.length, "repetição encontrada", "repetições encontradas")} nos lançamentos.`,
        rows: [
          ...ruleRows.map((rule) => ({
            label: rule.description,
            detail: `Custo fixo · vence dia ${rule.due_day}`,
            cents: rule.amount_cents,
            tone: "expense" as const,
          })),
          ...detected.slice(0, MAX_ROWS).map((item) => ({
            label: item.description,
            detail: `Apareceu em ${item.months} meses · média`,
            cents: item.averageCents,
            tone: "expense" as const,
          })),
        ],
        link: { label: "Ver custos fixos", href: "/custos-fixos" },
      };
    }

    case "balance": {
      const { data, error } = await db
        .from("account_balances")
        .select("name, balance_cents")
        .eq("archived", false)
        .order("balance_cents", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = data as { name: string; balance_cents: number }[];
      const total = rows.reduce((sum, row) => sum + row.balance_cents, 0);
      return {
        title: "Saldo em contas",
        summary: `Você tem ${formatCents(total)} somando ${plural(rows.length, "conta", "contas")}.`,
        rows: rows.map((row) => ({
          label: row.name,
          cents: row.balance_cents,
          tone: row.balance_cents < 0 ? "warning" : "neutral",
        })),
        link: { label: "Ver contas", href: "/contas" },
      };
    }

    case "upcoming": {
      const until = addDays(today, 30);
      const [pending, invoices, cards] = await Promise.all([
        db
          .from("transactions")
          .select("id, description, date, amount_cents")
          .eq("type", "expense")
          .eq("status", "pending")
          .lte("date", until),
        db
          .from("invoice_totals")
          .select("id, card_id, due_date, total_cents")
          .is("paid_at", null)
          .lte("due_date", until),
        db.from("credit_cards").select("id, name"),
      ]);
      for (const result of [pending, invoices, cards]) {
        if (result.error) throw new Error(result.error.message);
      }
      const bills = upcomingBills(
        pending.data ?? [],
        invoices.data ?? [],
        new Map((cards.data ?? []).map((card) => [card.id, card.name])),
        today,
        until,
      );
      const total = bills.reduce((sum, bill) => sum + bill.amountCents, 0);
      const overdue = bills.filter((bill) => bill.overdue).length;
      return {
        title: "Contas a vencer",
        summary:
          bills.length === 0
            ? "Nada a vencer nos próximos 30 dias."
            : `${plural(bills.length, "conta", "contas")} somando ${formatCents(total)} nos próximos 30 dias${overdue ? `, ${plural(overdue, "atrasada", "atrasadas")}` : ""}.`,
        rows: bills.slice(0, MAX_ROWS).map((bill) => ({
          label: bill.label,
          detail: `${bill.overdue ? "Atrasada · " : ""}${formatDate(bill.dueDate)}`,
          cents: bill.amountCents,
          tone: bill.overdue ? "warning" : "expense",
        })),
        link: { label: "Ver Dashboard", href: "/dashboard" },
      };
    }

    case "budget": {
      const month = period.month ?? today.slice(0, 7);
      const { start } = monthBounds(month);
      const [budgets, rows, categories] = await Promise.all([
        db.from("budgets").select("category_id, month, limit_cents").lte("month", start),
        loadTransactions(db, monthPeriod(month)),
        loadCategories(db),
      ]);
      if (budgets.error) throw new Error(budgets.error.message);
      const limits = effectiveBudgets(budgets.data as BudgetRow[], month);
      const spending = spendingByCategory(rows);
      const names = new Map(categories.map((c) => [c.id, c.name]));
      const items = [...limits.entries()]
        .map(([id, limit]) => ({ id, limit, spent: spending.get(id) ?? 0 }))
        .sort((a, b) => b.spent / b.limit - a.spent / a.limit);
      const over = items.filter((item) => budgetLevel(item.spent, item.limit) === "over");

      return {
        title: `Orçamento de ${formatMonth(month)}`,
        summary:
          items.length === 0
            ? "Nenhum orçamento definido."
            : over.length === 0
              ? "Todas as categorias estão dentro do orçamento."
              : `${plural(over.length, "categoria passou", "categorias passaram")} do orçamento.`,
        rows: items.map((item) => {
          const level = budgetLevel(item.spent, item.limit);
          return {
            label: names.get(item.id) ?? "Sem categoria",
            detail: level === "over" ? "Acima do orçamento" : level === "warning" ? "Perto do limite" : undefined,
            text: `${formatCents(item.spent)} de ${formatCents(item.limit)}`,
            tone: level === "ok" ? "neutral" : "warning",
          };
        }),
        link: { label: "Ver orçamento", href: `/orcamento?mes=${month}` },
      };
    }

    case "goals": {
      const [goals, balances] = await Promise.all([
        db.from("goals").select("name, target_cents, deadline, account_id").order("deadline"),
        db.from("account_balances").select("id, balance_cents"),
      ]);
      if (goals.error) throw new Error(goals.error.message);
      if (balances.error) throw new Error(balances.error.message);
      const goalRows = goals.data as {
        name: string;
        target_cents: number;
        deadline: string;
        account_id: string;
      }[];
      const balanceById = new Map(
        (balances.data as { id: string; balance_cents: number }[]).map((b) => [b.id, b.balance_cents]),
      );
      const counts = countGoalsByAccount(goalRows);
      return {
        title: "Suas metas",
        summary:
          goalRows.length === 0
            ? "Nenhuma meta cadastrada."
            : `${plural(goalRows.length, "meta", "metas")} em andamento.`,
        rows: goalRows.map((goal) => {
          const progress = goalProgress(goal, balanceById, counts, today);
          return {
            label: goal.name,
            detail:
              progress.status === "reached"
                ? "Alcançada"
                : progress.status === "overdue"
                  ? `Prazo vencido em ${formatDate(goal.deadline)}`
                  : `Guardar ${formatCents(progress.monthlyCents)} por mês até ${formatDate(goal.deadline)}`,
            text: `${Math.round(progress.percent)}% · ${formatCents(progress.savedCents)} de ${formatCents(goal.target_cents)}`,
            tone: progress.status === "overdue" ? "warning" : progress.status === "reached" ? "income" : "neutral",
          };
        }),
        link: { label: "Ver metas", href: "/metas" },
      };
    }

    case "projection": {
      const monthEnd = monthBounds(today.slice(0, 7)).end;
      const [balances, pending, invoices] = await Promise.all([
        db.from("account_balances").select("balance_cents").eq("archived", false),
        db
          .from("transactions")
          .select("type, amount_cents")
          .eq("status", "pending")
          .in("type", ["income", "expense"])
          .lt("date", monthEnd),
        db.from("invoice_totals").select("total_cents").is("paid_at", null).lt("due_date", monthEnd),
      ]);
      for (const result of [balances, pending, invoices]) {
        if (result.error) throw new Error(result.error.message);
      }
      const total = (balances.data ?? []).reduce((sum, row) => sum + row.balance_cents, 0);
      const projection = projectMonthEnd(total, pending.data ?? [], invoices.data ?? []);
      return {
        title: "Previsão para o fim do mês",
        summary: `Se tudo correr como previsto, você termina o mês com ${formatCents(projection.projectedCents)}.`,
        rows: [
          { label: "Saldo hoje", cents: projection.balanceCents, tone: "neutral" },
          { label: "A receber", cents: projection.pendingIncomeCents, tone: "income" },
          { label: "Contas a pagar", cents: projection.pendingExpenseCents, tone: "expense" },
          { label: "Faturas do mês", cents: projection.invoicesCents, tone: "expense" },
          {
            label: "Previsão",
            cents: projection.projectedCents,
            tone: projection.projectedCents < 0 ? "warning" : "income",
          },
        ],
        link: { label: "Ver Dashboard", href: "/dashboard" },
      };
    }

    default:
      return {
        title: "Não entendi a pergunta",
        summary:
          "Ainda respondo só alguns tipos de pergunta. Tente uma destas, ou escreva parecido:",
        rows: [],
        suggestions: SUGGESTIONS.slice(0, 6),
      };
  }
}
