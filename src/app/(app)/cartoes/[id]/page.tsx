import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCardVisual } from "@/components/credit-card-visual";
import { Card, EmptyState, PageHeader, secondaryButtonClass } from "@/components/ui";
import { invoiceStatus } from "@/lib/cards";
import {
  capitalizeFirst,
  formatDate,
  formatMonth,
  todayInBrazil,
} from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import { InvoiceBadge } from "../invoice-badge";

interface Invoice {
  id: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
  paid_at: string | null;
  total_cents: number;
}

export default async function CardInvoicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await requireDb();
  const [card, invoices] = await Promise.all([
    db
      .from("credit_cards")
      .select("name, color, style, last_digits, limit_cents, closing_day, due_day")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("invoice_totals")
      .select("id, reference_month, closing_date, due_date, paid_at, total_cents")
      .eq("card_id", id)
      .order("reference_month", { ascending: false }),
  ]);
  if (!card.data) notFound();
  if (invoices.error) throw new Error(invoices.error.message);

  // Faturas vazias surgem quando uma compra é movida ou apagada.
  const rows = (invoices.data as Invoice[]).filter(
    (invoice) => invoice.total_cents > 0 || invoice.paid_at,
  );
  const today = todayInBrazil();
  const openCents = rows
    .filter((invoice) => !invoice.paid_at)
    .reduce((sum, invoice) => sum + invoice.total_cents, 0);
  const next = rows
    .filter((invoice) => !invoice.paid_at && invoice.total_cents > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  return (
    <>
      <PageHeader
        title={card.data.name}
        action={
          <Link href={`/cartoes/${id}/editar`} className={secondaryButtonClass}>
            Editar cartão
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="w-36 shrink-0 sm:w-40">
            <CreditCardVisual card={card.data} />
          </div>
          <dl className="grid min-w-0 flex-1 basis-56 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Próxima fatura</dt>
              <dd className="whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums">
                {formatCents(next?.total_cents ?? 0)}
              </dd>
              <dd className="text-xs text-muted">
                {next ? `Vence ${formatDate(next.due_date)}` : "Nada a pagar"}
              </dd>
            </div>
            {card.data.limit_cents > 0 && (
              <div>
                <dt className="text-sm text-muted">Limite disponível</dt>
                <dd className="whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums">
                  {formatCents(card.data.limit_cents - openCents)}
                </dd>
                <dd className="text-xs text-muted tabular-nums">
                  de {formatCents(card.data.limit_cents)}
                </dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dd className="text-xs text-muted">
                Fecha dia {card.data.closing_day} · Vence dia {card.data.due_day}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            message="Nenhuma fatura ainda. Lance uma compra neste cartão."
            href="/lancamentos/novo"
            linkLabel="Novo lançamento"
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={`/faturas/${invoice.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 hover:opacity-70"
                >
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-sm font-medium">
                      {capitalizeFirst(formatMonth(invoice.reference_month.slice(0, 7)))}
                    </p>
                    <p className="text-xs text-muted">
                      Fecha {formatDate(invoice.closing_date)} · Vence{" "}
                      {formatDate(invoice.due_date)}
                    </p>
                  </div>
                  <InvoiceBadge status={invoiceStatus(invoice, today)} />
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCents(invoice.total_cents)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
