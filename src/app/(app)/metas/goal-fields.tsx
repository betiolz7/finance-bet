import { Field, inputClass } from "@/components/ui";
import type { Option } from "../lancamentos/transaction-form";

export function GoalFields({
  accounts,
  name = "",
  target = "",
  deadline = "",
  accountId,
}: {
  accounts: Option[];
  name?: string;
  target?: string;
  deadline?: string;
  accountId?: string;
}) {
  return (
    <>
      <Field label="Nome">
        <input name="name" required defaultValue={name} className={inputClass} />
      </Field>
      <Field label="Valor da meta (R$)">
        <input
          name="target"
          inputMode="decimal"
          required
          placeholder="0,00"
          defaultValue={target}
          className={inputClass}
        />
      </Field>
      <Field label="Prazo">
        <input
          name="deadline"
          type="date"
          required
          defaultValue={deadline}
          className={inputClass}
        />
      </Field>
      <Field label="Conta onde o dinheiro fica">
        <select name="accountId" defaultValue={accountId} className={inputClass}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
