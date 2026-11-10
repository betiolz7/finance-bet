import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageHeader, inputClass } from "@/components/ui";
import { centsToInput } from "@/lib/money";
import { requireDb } from "@/lib/supabase/server";
import { updateCardTransaction } from "../../../cartoes/actions";
import { loadFormOptions } from "../../../lancamentos/queries";

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await requireDb();
  const { data } = await db
    .from("transactions")
    .select("description, amount_cents, category_id, installment_total, invoice_id")
    .eq("id", id)
    .eq("type", "expense")
    .not("invoice_id", "is", null)
    .maybeSingle();
  if (!data) notFound();

  const { categories } = await loadFormOptions();

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar compra" />
      <Card>
        <ActionForm action={updateCardTransaction.bind(null, id)} className="space-y-4">
          <Field label="Descrição">
            <input
              name="description"
              required
              maxLength={200}
              defaultValue={data.description}
              className={inputClass}
            />
          </Field>
          <Field label="Valor (R$)">
            <input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={centsToInput(data.amount_cents)}
              className={inputClass}
            />
          </Field>
          <Field label="Categoria">
            <select
              name="categoryId"
              required
              defaultValue={data.category_id}
              className={inputClass}
            >
              {categories
                .filter((category) => category.kind === "expense")
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </Field>
          {data.installment_total > 1 && (
            <p className="text-sm text-muted">
              A alteração vale somente para esta parcela.
            </p>
          )}
          <SubmitButton>Salvar alterações</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
