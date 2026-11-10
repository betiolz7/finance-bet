import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { centsToInput } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import { loadFormOptions } from "../../../lancamentos/queries";
import { updateCard } from "../../actions";
import { CardFields } from "../../card-fields";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await requireDb();
  const { data } = await db
    .from("credit_cards")
    .select("name, limit_cents, closing_day, due_day, payment_account_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const { accounts } = await loadFormOptions([data.payment_account_id]);

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar cartão" />
      <Card>
        <ActionForm action={updateCard.bind(null, id)} className="space-y-4">
          <CardFields
            accounts={accounts}
            name={data.name}
            limit={centsToInput(data.limit_cents)}
            closingDay={String(data.closing_day)}
            dueDay={String(data.due_day)}
            accountId={data.payment_account_id}
          />
          <p className="text-sm text-muted">
            Mudar os dias de fechamento ou vencimento vale apenas para faturas
            novas.
          </p>
          <SubmitButton>Salvar alterações</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
