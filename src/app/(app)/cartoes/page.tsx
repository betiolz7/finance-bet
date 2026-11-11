import Link from "next/link";
import { CreditCardVisual } from "@/components/credit-card-visual";
import {
  Card,
  EmptyState,
  PageHeader,
  secondaryButtonClass,
  textButtonClass,
} from "@/components/ui";
import { nextInvoiceToPay, usedLimitCents } from "@/lib/cards";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import { setCardArchived } from "./actions";

interface CreditCard {
  id: string;
  name: string;
  limit_cents: number;
  closing_day: number;
  due_day: number;
  archived: boolean;
  color: string | null;
  style: string | null;
  last_digits: string | null;
}

interface Invoice {
  id: string;
  card_id: string;
  due_date: string;
  paid_at: string | null;
  total_cents: number;
}

export default async function CardsPage() {
  const db = await requireDb();
  const [cards, invoices] = await Promise.all([
    db
      .from("credit_cards")
      .select("id, name, limit_cents, closing_day, due_day, archived, color, style, last_digits")
      .order("name"),
    db
      .from("invoice_totals")
      .select("id, card_id, due_date, paid_at, total_cents")
      .is("paid_at", null),
  ]);
  if (cards.error) throw new Error(cards.error.message);
  if (invoices.error) throw new Error(invoices.error.message);

  const allCards = cards.data as CreditCard[];
  const active = allCards.filter((card) => !card.archived);
  const archived = allCards.filter((card) => card.archived);
  const open = invoices.data as Invoice[];
  const forCard = (id: string) => open.filter((i) => i.card_id === id);

  return (
    <>
      <PageHeader
        title="Cartões"
        action={
          <Link href="/cartoes/modelos" className={secondaryButtonClass}>
            Ver modelos de cartão
          </Link>
        }
      />

      {active.length === 0 ? (
        <Card className="mb-4">
          <EmptyState
            message="Nenhum cartão conectado ainda. Os cartões entram pelo Open Finance."
            href="/open-finance"
            linkLabel="Conectar banco"
          />
        </Card>
      ) : (
        <div className="mb-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {active.map((card) => (
            <CardTile key={card.id} card={card} invoices={forCard(card.id)} />
          ))}
        </div>
      )}


      {archived.length > 0 && (
        <Card>
          <h2 className="mb-1 font-semibold">Arquivados</h2>
          <ul className="divide-y divide-line">
            {archived.map((card) => (
              <li key={card.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm">{card.name}</span>
                <form action={setCardArchived.bind(null, card.id, false)}>
                  <button type="submit" className={textButtonClass}>
                    Reativar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function CardTile({ card, invoices }: { card: CreditCard; invoices: Invoice[] }) {
  const used = usedLimitCents(invoices);
  const next = nextInvoiceToPay(invoices);
  const percent =
    card.limit_cents > 0 ? Math.min(100, (used / card.limit_cents) * 100) : 0;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex gap-5">
        <Link
          href={next ? `/faturas/${next.id}` : `/cartoes/${card.id}`}
          className="w-32 shrink-0 sm:w-36"
        >
          <CreditCardVisual card={card} className="transition hover:-translate-y-1" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <div>
            <p className="text-sm text-muted">Fatura a pagar</p>
            <p className="whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums">
              {formatCents(next?.total_cents ?? 0)}
            </p>
            <p className="text-xs text-muted">
              {next ? `Vence ${formatDate(next.due_date)}` : "Nada a pagar"}
            </p>
          </div>
          {card.limit_cents > 0 && (
            <div>
              <p className="text-sm text-muted">Limite disponível</p>
              <p className="whitespace-nowrap font-semibold tabular-nums">
                {formatCents(card.limit_cents - used)}
              </p>
            </div>
          )}
        </div>
      </div>

      {card.limit_cents > 0 && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-soft">
            <div
              className={`h-full rounded-full ${percent >= 80 ? "bg-expense" : "bg-chart"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted tabular-nums">
            {formatCents(used)} usados de {formatCents(card.limit_cents)}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Fecha dia {card.closing_day} · Vence dia {card.due_day}
        </p>
        <div className="flex items-center gap-3">
          <Link href={`/cartoes/${card.id}`} className={textButtonClass}>
            Faturas
          </Link>
          <Link href={`/cartoes/${card.id}/editar`} className={textButtonClass}>
            Editar
          </Link>
          <form action={setCardArchived.bind(null, card.id, true)}>
            <button type="submit" className={textButtonClass}>
              Arquivar
            </button>
          </form>
        </div>
      </div>
    </Card>
  );
}
