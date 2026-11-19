import Link from "next/link";
import { BankIcon, type Institution } from "@/components/bank-icon";
import { ConfirmButton } from "@/components/forms";
import { textButtonClass } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { TransactionStatus, TransactionType } from "@/lib/transactions";
import { deleteTransaction, setTransactionStatus } from "./actions";

export const LISTED_TRANSACTION_SELECT = `id, type, status, amount_cents, date, description, recurring_rule_id,
       to_account_id, invoice_id, installment_number, installment_total,
       invoice:invoices(card:credit_cards(name, institution_name, institution_logo, institution_color)),
       category:categories(name, color),
       account:accounts!transactions_account_id_fkey(name, institution_name, institution_logo, institution_color),
       to_account:accounts!transactions_to_account_id_fkey(name)`;

export type ListedType = TransactionType | "invoice_payment";

export interface ListedTransaction {
  id: string;
  type: ListedType;
  status: TransactionStatus;
  amount_cents: number;
  date: string;
  description: string;
  recurring_rule_id: string | null;
  to_account_id: string | null;
  invoice_id: string | null;
  installment_number: number | null;
  installment_total: number | null;
  category: { name: string; color: string } | null;
  account: ({ name: string } & Institution) | null;
  to_account: { name: string } | null;
  invoice: { card: { name: string } & Institution } | null;
}

const AMOUNT_STYLE: Record<ListedType, { sign: string; className: string }> = {
  income: { sign: "+ ", className: "text-income" },
  expense: { sign: "- ", className: "text-expense" },
  transfer: { sign: "", className: "text-ink" },
  invoice_payment: { sign: "", className: "text-ink" },
};

/**
 * Uma linha da lista de lançamentos. Com `accountId`, a transferência aparece
 * com sinal do ponto de vista dessa conta (entrada + / saída -).
 */
export function TransactionItem({
  row,
  accountId,
}: {
  row: ListedTransaction;
  accountId?: string;
}) {
  const style =
    accountId && row.type === "transfer"
      ? row.to_account_id === accountId
        ? AMOUNT_STYLE.income
        : AMOUNT_STYLE.expense
      : AMOUNT_STYLE[row.type];
  const nextStatus = row.status === "paid" ? "pending" : "paid";
  const installment =
    row.installment_total && row.installment_total > 1
      ? ` (${row.installment_number}/${row.installment_total})`
      : "";

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <BankIcon
        institution={row.account ?? row.invoice?.card}
        fallbackName={row.account?.name ?? row.invoice?.card.name ?? "?"}
      />
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium">
          {row.description}
          {installment}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>{formatDate(row.date)}</span>
          {row.category && (
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: row.category.color }}
              />
              {row.category.name}
            </span>
          )}
          <span>
            {row.account?.name ?? row.invoice?.card.name}
            {row.to_account && ` → ${row.to_account.name}`}
          </span>
          {row.recurring_rule_id && (
            <span className="rounded bg-canvas px-1.5 py-0.5 font-medium">Fixo</span>
          )}
          {row.status === "pending" && (
            <span className="rounded bg-pending-soft px-1.5 py-0.5 font-medium text-pending">
              Pendente
            </span>
          )}
        </p>
      </div>

      <p className={`text-sm font-semibold tabular-nums ${style.className}`}>
        {style.sign}
        {formatCents(row.amount_cents)}
      </p>

      {row.invoice_id ? (
        <Link href={`/faturas/${row.invoice_id}`} className={textButtonClass}>
          Ver fatura
        </Link>
      ) : (
        <div className="flex items-center gap-3">
          <form action={setTransactionStatus.bind(null, row.id, nextStatus)}>
            <button type="submit" className={textButtonClass}>
              {row.status === "paid" ? "Desfazer pgto." : "Marcar pago"}
            </button>
          </form>
          <Link href={`/lancamentos/${row.id}/editar`} className={textButtonClass}>
            Editar
          </Link>
          <form action={deleteTransaction.bind(null, row.id)}>
            <ConfirmButton
              message={`Apagar "${row.description}"?`}
              className={textButtonClass}
            >
              Apagar
            </ConfirmButton>
          </form>
        </div>
      )}
    </li>
  );
}
