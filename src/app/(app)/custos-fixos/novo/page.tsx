import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, EmptyState, Field, PageHeader, inputClass } from "@/components/ui";
import { formatMonth, shiftMonth, todayInBrazil } from "@/lib/dates";
import { parseRecurringType } from "@/lib/recurring";
import { loadFormOptions } from "../../lancamentos/queries";
import { createRecurringRule } from "../actions";
import { RecurringFields } from "../recurring-fields";

export default async function NewFixedPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const type = parseRecurringType((await searchParams).tipo);
  const isIncome = type === "income";
  const { accounts, categories } = await loadFormOptions();
  const hasCategory = categories.some((c) => c.kind === type);

  const currentMonth = todayInBrazil().slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(currentMonth, i));

  return (
    <div className="max-w-xl">
      <PageHeader title={isIncome ? "Nova receita fixa" : "Novo gasto fixo"} />
      <Card>
        {accounts.length === 0 ? (
          <EmptyState
            message="Conecte seu banco antes de cadastrar um fixo."
            href="/open-finance"
            linkLabel="Conectar banco"
          />
        ) : !hasCategory ? (
          <EmptyState
            message={`Cadastre uma categoria de ${isIncome ? "receita" : "despesa"} antes.`}
            href="/categorias"
            linkLabel="Cadastrar categorias"
          />
        ) : (
          <ActionForm action={createRecurringRule} className="space-y-4">
            <RecurringFields
              type={type}
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
              {isIncome
                ? "Se você já recebeu este valor neste mês, escolha o próximo mês para não lançar em dobro."
                : "Se você já pagou este gasto neste mês, escolha o próximo mês para não lançar em dobro."}
            </p>
            <SubmitButton>{isIncome ? "Salvar receita fixa" : "Salvar gasto fixo"}</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
