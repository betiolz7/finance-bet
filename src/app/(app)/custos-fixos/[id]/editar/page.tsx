import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { centsToInput } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import { loadFormOptions } from "../../../lancamentos/queries";
import { updateRecurringRule } from "../../actions";
import { RecurringFields } from "../../recurring-fields";

export default async function EditFixedCostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await requireDb();
  const { data } = await db
    .from("recurring_rules")
    .select("description, amount_cents, due_day, category_id, account_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const { accounts, categories } = await loadFormOptions([data.account_id]);

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar custo fixo" />
      <Card>
        <ActionForm action={updateRecurringRule.bind(null, id)} className="space-y-4">
          <RecurringFields
            accounts={accounts}
            categories={categories}
            initial={{
              description: data.description,
              amount: centsToInput(data.amount_cents),
              dueDay: String(data.due_day),
              categoryId: data.category_id,
              accountId: data.account_id,
            }}
          />
          <p className="text-sm text-muted">
            As alterações valem para os próximos meses. Para mudar só este mês,
            use &quot;Ajustar mês&quot; na lista.
          </p>
          <SubmitButton>Salvar alterações</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
