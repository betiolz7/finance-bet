import { Field, inputClass } from "@/components/ui";

export const ACCOUNT_KINDS: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  investment: "Investimento",
};

export function AccountFields({
  name = "",
  kind = "checking",
  initialBalance = "",
}: {
  name?: string;
  kind?: string;
  initialBalance?: string;
}) {
  return (
    <>
      <Field label="Nome">
        <input name="name" required defaultValue={name} className={inputClass} />
      </Field>
      <Field label="Tipo">
        <select name="kind" defaultValue={kind} className={inputClass}>
          {Object.entries(ACCOUNT_KINDS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Saldo inicial (R$)">
        <input
          name="initialBalance"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={initialBalance}
          className={inputClass}
        />
      </Field>
    </>
  );
}
