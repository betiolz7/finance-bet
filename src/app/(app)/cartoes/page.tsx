import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, EmptyState, PageHeader, textButtonClass } from "@/components/ui";
import { nextInvoiceToPay, usedLimitCents } from "@/lib/cards";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import { loadFormOptions } from "../lancamentos/queries";
import { createCard, setCardArchived } from "./actions";
import { CardFields } from "./card-fields";

interface CreditCard {
  id: string;
  name: string;
  limit_cents: number;
  closing_day: number;
  due_day: number;
  archived: boolean;
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
  const [cards, invoices, options] = await Promise.all([
    db
      .from("credit_cards")
      .select("id, name, limit_cents, closing_day, due_day, archived")
      .order("name"),
    db
      .from("invoice_totals")
      .select("id, card_id, due_date, paid_at, total_cents")
      .is("paid_at", null),
    loadFormOptions(),
  ]);
  if (cards.error) throw new Error(cards.error.message);
  if (invoices.error) throw new Error(invoices.error.message);

  const allCards = cards.data as CreditCard[];
  const open = invoices.data as Invoice[];
  const forCard = (id: string) => open.filter((i) => i.card_id === id);

  return (
    <>
      <PageHeader title="Cartões" />

      <Card className="mb-4">
        {allCards.length === 0 ? (
          <EmptyState message="Nenhum cartão cadastrado ainda." />
        ) : (
          <ul className="divide-y divide-line">
            {allCards.map((card) => (
              <CardItem key={card.id} card={card} invoices={forCard(card.id)} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Novo cartão</h2>
        {options.accounts.length === 0 ? (
          <EmptyState
            message="Cadastre uma conta antes de adicionar um cartão."
            href="/contas"
            linkLabel="Cadastrar conta"
          />
        ) : (
          <ActionForm action={createCard} className="grid items-end gap-4 sm:grid-cols-3">
            <CardFields accounts={options.accounts} />
            <SubmitButton>Adicionar</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </>
  );
}

function CardItem({ card, invoices }: { card: CreditCard; invoices: Invoice[] }) {
  const used = usedLimitCents(invoices);
  const next = nextInvoiceToPay(invoices);
  const percent =
    card.limit_cents > 0 ? Math.min(100, (used / card.limit_cents) * 100) : 0;

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1 basis-48">
          <Link href={`/cartoes/${card.id}`} className="text-sm font-medium hover:underline">
            {card.name}
          </Link>
          <p className="text-xs text-muted">
            Fecha dia {card.closing_day} · Vence dia {card.due_day}
            {card.archived && " · Arquivado"}
          </p>
        </div>
        {next && (
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums">
              {formatCents(next.total_cents)}
            </p>
            <p className="text-xs text-muted">vence {formatDate(next.due_date)}</p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Link href={`/cartoes/${card.id}`} className={textButtonClass}>
            Faturas
          </Link>
          <Link href={`/cartoes/${card.id}/editar`} className={textButtonClass}>
            Editar
          </Link>
          <form action={setCardArchived.bind(null, card.id, !card.archived)}>
            <button type="submit" className={textButtonClass}>
              {card.archived ? "Reativar" : "Arquivar"}
            </button>
          </form>
        </div>
      </div>

      {card.limit_cents > 0 && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-canvas">
            <div
              className={`h-full rounded-full ${percent >= 80 ? "bg-expense" : "bg-chart"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted tabular-nums">
            {formatCents(used)} usados de {formatCents(card.limit_cents)} · disponível{" "}
            {formatCents(card.limit_cents - used)}
          </p>
        </div>
      )}
    </li>
  );
}
