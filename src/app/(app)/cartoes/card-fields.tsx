import { Field, inputClass } from "@/components/ui";
import type { Option } from "../lancamentos/transaction-form";

export function CardFields({
  accounts,
  name = "",
  limit = "",
  closingDay = "",
  dueDay = "",
  accountId,
}: {
  accounts: Option[];
  name?: string;
  limit?: string;
  closingDay?: string;
  dueDay?: string;
  accountId?: string;
}) {
  return (
    <>
      <Field label="Nome">
        <input name="name" required defaultValue={name} className={inputClass} />
      </Field>
      <Field label="Limite (R$)">
        <input
          name="limit"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={limit}
          className={inputClass}
        />
      </Field>
      <Field label="Dia de fechamento">
        <input
          name="closingDay"
          type="number"
          min={1}
          max={31}
          required
          defaultValue={closingDay}
          className={inputClass}
        />
      </Field>
      <Field label="Dia de vencimento">
        <input
          name="dueDay"
          type="number"
          min={1}
          max={31}
          required
          defaultValue={dueDay}
          className={inputClass}
        />
      </Field>
      <Field label="Conta de pagamento">
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
