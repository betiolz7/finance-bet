import { notFound } from "next/navigation";
import { BankSelect } from "@/components/bank-select";
import { ActionForm, SubmitButton } from "@/components/forms";
import { loadBankOptions } from "@/lib/institution-server";
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
  const [{ data }, connectors] = await Promise.all([
    db
      .from("accounts")
      .select("name, kind, initial_balance_cents, institution_name")
      .eq("id", id)
      .maybeSingle(),
    loadBankOptions(),
  ]);
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
          <BankSelect connectors={connectors} current={data.institution_name} />
          <SubmitButton>Salvar alterações</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
