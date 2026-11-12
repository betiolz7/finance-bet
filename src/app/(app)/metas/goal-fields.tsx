import { Field, inputClass } from "@/components/ui";
import type { Investment } from "@/lib/investments";
import { formatCents } from "@/lib/money";
import type { Option } from "../lancamentos/transaction-form";

export function GoalFields({
  accounts,
  investments = [],
  name = "",
  target = "",
  deadline = "",
  source,
}: {
  accounts: Option[];
  investments?: Investment[];
  name?: string;
  target?: string;
  deadline?: string;
  /** "acc:<id>" ou "inv:<id>". */
  source?: string;
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
      <Field label="Onde o dinheiro fica">
        <select name="source" required defaultValue={source} className={inputClass}>
          <optgroup label="Contas">
            {accounts.map((account) => (
              <option key={account.id} value={`acc:${account.id}`}>
                {account.name}
              </option>
            ))}
          </optgroup>
          {investments.length > 0 && (
            <optgroup label="Investimentos">
              {investments.map((investment) => (
                <option key={investment.id} value={`inv:${investment.id}`}>
                  {investment.name} ({formatCents(investment.balanceCents)})
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Field>
    </>
  );
}
