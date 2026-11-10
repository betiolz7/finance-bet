import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, EmptyState, Field, PageHeader, inputClass } from "@/components/ui";
import { formatMonth, shiftMonth, todayInBrazil } from "@/lib/dates";
import { loadFormOptions } from "../../lancamentos/queries";
import { createRecurringRule } from "../actions";
import { RecurringFields } from "../recurring-fields";

export default async function NewFixedCostPage() {
  const { accounts, categories } = await loadFormOptions();
  const hasExpenseCategory = categories.some((c) => c.kind === "expense");

  const currentMonth = todayInBrazil().slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(currentMonth, i));

  return (
    <div className="max-w-xl">
      <PageHeader title="Novo custo fixo" />
      <Card>
        {accounts.length === 0 ? (
          <EmptyState
            message="Cadastre uma conta antes de criar um custo fixo."
            href="/contas"
            linkLabel="Cadastrar conta"
          />
        ) : !hasExpenseCategory ? (
          <EmptyState
            message="Cadastre uma categoria de despesa antes de criar um custo fixo."
            href="/categorias"
            linkLabel="Cadastrar categorias"
          />
        ) : (
          <ActionForm action={createRecurringRule} className="space-y-4">
            <RecurringFields
              accounts={accounts}
              categories={categories}
              initial={{
                description: "",
                amount: "",
                dueDay: "",
                categoryId: "",
                accountId: accounts[0].id,
              }}
            />
            <Field label="Primeiro mês">
              <select
                name="startMonth"
                defaultValue={currentMonth}
                className={inputClass}
              >
                {months.map((month) => (
                  <option key={month} value={month}>
                    {formatMonth(month)}
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-sm text-muted">
              Se você já pagou este custo neste mês, escolha o próximo mês para
              não lançar em dobro.
            </p>
            <SubmitButton>Salvar custo fixo</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
