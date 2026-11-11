import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCardVisual } from "@/components/credit-card-visual";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import {
  Card,
  EmptyState,
  Field,
  PageHeader,
  inputClass,
  secondaryButtonClass,
  textButtonClass,
} from "@/components/ui";
import { invoiceStatus } from "@/lib/cards";
import { formatDate, formatMonth, todayInBrazil } from "@/lib/dates";
import { centsToInput, formatCents } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import {
  deleteCardPurchase,
  deleteCardTransaction,
  moveCardTransaction,
  payInvoice,
  unpayInvoice,
} from "../../cartoes/actions";
import { InvoiceBadge } from "../../cartoes/invoice-badge";
import { loadFormOptions } from "../../lancamentos/queries";

interface InvoiceDetail {
  id: string;
  card_id: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
  paid_at: string | null;
  card: {
    name: string;
    payment_account_id: string;
    color: string | null;
    style: string | null;
    last_digits: string | null;
  };
}

interface Item {
  id: string;
  type: "expense" | "invoice_payment";
  amount_cents: number;
  date: string;
  description: string;
  installment_group_id: string | null;
  installment_number: number | null;
  installment_total: number | null;
  category: { name: string; color: string } | null;
  account: { name: string } | null;
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await requireDb();
  const [invoiceResult, itemsResult] = await Promise.all([
    db
      .from("invoices")
      .select(
        "id, card_id, reference_month, closing_date, due_date, paid_at, card:credit_cards(name, payment_account_id, color, style, last_digits)",
      )
      .eq("id", id)
      .maybeSingle(),
    db
      .from("transactions")
      .select(
        `id, type, amount_cents, date, description,
         installment_group_id, installment_number, installment_total,
         category:categories(name, color),
         account:accounts!transactions_account_id_fkey(name)`,
      )
      .eq("invoice_id", id)
      .order("date"),
  ]);
  if (!invoiceResult.data) notFound();
  if (itemsResult.error) throw new Error(itemsResult.error.message);

  const invoice = invoiceResult.data as unknown as InvoiceDetail;
  const items = itemsResult.data as unknown as Item[];
  const purchases = items.filter((item) => item.type === "expense");
  const payment = items.find((item) => item.type === "invoice_payment");
  const total = purchases.reduce((sum, item) => sum + item.amount_cents, 0);
  const today = todayInBrazil();
  const isOpen = !invoice.paid_at;
  const { accounts } = await loadFormOptions([invoice.card.payment_account_id]);

  return (
    <>
      <PageHeader
        title={`${invoice.card.name} · ${formatMonth(invoice.reference_month.slice(0, 7))}`}
        action={
          <Link href={`/cartoes/${invoice.card_id}`} className={secondaryButtonClass}>
            Todas as faturas
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-6">
          <Link
            href={`/cartoes/${invoice.card_id}`}
            className="w-36 shrink-0 sm:w-40"
            aria-label={`Ver todas as faturas de ${invoice.card.name}`}
          >
            <CreditCardVisual card={invoice.card} className="transition hover:-translate-y-1" />
          </Link>
          <div className="min-w-0 flex-1 basis-56">
            <InvoiceBadge status={invoiceStatus(invoice, today)} />
            <p className="mt-3 text-sm text-muted">Total da fatura</p>
            <p className="whitespace-nowrap text-3xl font-semibold tracking-tight tabular-nums">
              {formatCents(total)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:max-w-sm">
              <div>
                <dt className="text-xs text-muted">Fecha em</dt>
                <dd className="font-medium tabular-nums">{formatDate(invoice.closing_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Vence em</dt>
                <dd className="font-medium tabular-nums">{formatDate(invoice.due_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Compras</dt>
                <dd className="font-medium tabular-nums">{purchases.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        {purchases.length === 0 ? (
          <EmptyState message="Nenhuma compra nesta fatura." />
        ) : (
          <ul className="divide-y divide-line">
            {purchases.map((item) => (
              <PurchaseItem key={item.id} item={item} editable={isOpen} />
            ))}
          </ul>
        )}
      </Card>

      {isOpen ? (
        total > 0 && (
          <Card>
            <h2 className="mb-1 font-semibold">Pagar fatura</h2>
            <p className="mb-3 text-sm text-muted">
              Registra a saída da conta e encerra esta fatura. Ajuste o valor se
              o banco cobrou algo a mais.
            </p>
            <ActionForm
              action={payInvoice.bind(null, invoice.id)}
              className="grid items-end gap-4 sm:grid-cols-4"
            >
              <Field label="Valor (R$)">
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue={centsToInput(total)}
                  className={inputClass}
                />
              </Field>
              <Field label="Data">
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={today}
                  className={inputClass}
                />
              </Field>
              <Field label="Conta">
                <select
                  name="accountId"
                  defaultValue={invoice.card.payment_account_id}
                  className={inputClass}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </Field>
              <SubmitButton>Registrar pagamento</SubmitButton>
            </ActionForm>
          </Card>
        )
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Paga em {formatDate(invoice.paid_at as string)}
              {payment && (
                <>
                  {" "}
                  com {payment.account?.name}:{" "}
                  <span className="font-semibold tabular-nums">
                    {formatCents(payment.amount_cents)}
                  </span>
                </>
              )}
            </p>
            <form action={unpayInvoice.bind(null, invoice.id)}>
              <ConfirmButton
                message="Desfazer o pagamento? O valor volta para a conta e a fatura é reaberta."
                className={secondaryButtonClass}
              >
                Desfazer pagamento
              </ConfirmButton>
            </form>
          </div>
        </Card>
      )}
    </>
  );
}

function PurchaseItem({ item, editable }: { item: Item; editable: boolean }) {
  const installment =
    item.installment_total && item.installment_total > 1
      ? ` (${item.installment_number}/${item.installment_total})`
      : "";

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate text-sm font-medium">
          {item.description}
          {installment}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>{formatDate(item.date)}</span>
          {item.category && (
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: item.category.color }}
              />
              {item.category.name}
            </span>
          )}
        </p>
      </div>

      <p className="text-sm font-semibold tabular-nums">
        {formatCents(item.amount_cents)}
      </p>

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <ActionForm action={moveCardTransaction.bind(null, item.id, -1)}>
            <button type="submit" className={textButtonClass}>
              Fatura anterior
            </button>
          </ActionForm>
          <ActionForm action={moveCardTransaction.bind(null, item.id, 1)}>
            <button type="submit" className={textButtonClass}>
              Próxima fatura
            </button>
          </ActionForm>
          <Link href={`/compras/${item.id}/editar`} className={textButtonClass}>
            Editar
          </Link>
          <form action={deleteCardTransaction.bind(null, item.id)}>
            <ConfirmButton
              message={
                installment
                  ? `Apagar somente esta parcela${installment}?`
                  : `Apagar "${item.description}"?`
              }
              className={textButtonClass}
            >
              Apagar
            </ConfirmButton>
          </form>
          {installment && item.installment_group_id && (
            <form action={deleteCardPurchase.bind(null, item.installment_group_id)}>
              <ConfirmButton
                message={`Apagar todas as parcelas de "${item.description}"? Parcelas de faturas já pagas serão mantidas.`}
                className={textButtonClass}
              >
                Apagar compra
              </ConfirmButton>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
