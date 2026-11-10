import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { centsToInput } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import { loadFormOptions } from "../../../lancamentos/queries";
import { updateGoal } from "../../actions";
import { GoalFields } from "../../goal-fields";

export default async function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await requireDb();
  const { data } = await db
    .from("goals")
    .select("name, target_cents, deadline, account_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const { accounts } = await loadFormOptions([data.account_id]);

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar meta" />
      <Card>
        <ActionForm action={updateGoal.bind(null, id)} className="space-y-4">
          <GoalFields
            accounts={accounts}
            name={data.name}
            target={centsToInput(data.target_cents)}
            deadline={data.deadline}
            accountId={data.account_id}
          />
          <SubmitButton>Salvar alterações</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
