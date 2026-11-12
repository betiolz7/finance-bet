import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { loadInvestments } from "@/lib/investments-server";
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
    .select("name, target_cents, deadline, account_id, investment_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const [{ accounts }, { investments }] = await Promise.all([
    loadFormOptions(data.account_id ? [data.account_id] : []),
    loadInvestments(db),
  ]);

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar meta" />
      <Card>
        <ActionForm action={updateGoal.bind(null, id)} className="space-y-4">
          <GoalFields
            accounts={accounts}
            investments={investments}
            name={data.name}
            target={centsToInput(data.target_cents)}
            deadline={data.deadline}
            source={data.investment_id ? `inv:${data.investment_id}` : `acc:${data.account_id}`}
          />
          <SubmitButton>Salvar alterações</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
