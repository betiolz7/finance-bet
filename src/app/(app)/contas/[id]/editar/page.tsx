import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { centsToInput } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import { AccountFields } from "../../account-fields";
import { updateAccount } from "../../actions";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await requireDb();
  const { data } = await db
    .from("accounts")
    .select("name, kind, initial_balance_cents")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar conta" />
      <Card>
        <ActionForm action={updateAccount.bind(null, id)} className="space-y-4">
          <AccountFields
            name={data.name}
            kind={data.kind}
            initialBalance={centsToInput(data.initial_balance_cents)}
          />
          <SubmitButton>Salvar alterações</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
