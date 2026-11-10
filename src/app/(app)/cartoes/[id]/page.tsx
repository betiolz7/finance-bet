import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { invoiceStatus } from "@/lib/cards";
import { formatDate, formatMonth, todayInBrazil } from "@/lib/dates";
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
    db.from("credit_cards").select("name").eq("id", id).maybeSingle(),
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

  return (
    <>
      <PageHeader title={card.data.name} />
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
                    <p className="text-sm font-medium capitalize">
                      {formatMonth(invoice.reference_month.slice(0, 7))}
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
