import { Field, inputClass } from "@/components/ui";
import type { CategoryOption, Option } from "../lancamentos/transaction-form";

export interface RecurringFormValues {
  description: string;
  amount: string;
  dueDay: string;
  categoryId: string;
  accountId: string;
}

export function RecurringFields({
  accounts,
  categories,
  initial,
}: {
  accounts: Option[];
  categories: CategoryOption[];
  initial: RecurringFormValues;
}) {
  return (
    <>
      <Field label="Descrição">
        <input
          name="description"
          required
          maxLength={200}
          defaultValue={initial.description}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor (R$)">
          <input
            name="amount"
            inputMode="decimal"
            required
            placeholder="0,00"
            defaultValue={initial.amount}
            className={inputClass}
          />
        </Field>
        <Field label="Dia do vencimento">
          <input
            name="dueDay"
            type="number"
            min={1}
            max={31}
            required
            defaultValue={initial.dueDay}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoria">
          <select
            name="categoryId"
            required
            defaultValue={initial.categoryId}
            className={inputClass}
          >
            <option value="">Selecione</option>
            {categories
              .filter((category) => category.kind === "expense")
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Conta">
          <select
            name="accountId"
            required
            defaultValue={initial.accountId}
            className={inputClass}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </>
  );
}
