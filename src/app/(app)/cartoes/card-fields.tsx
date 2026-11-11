import { Field, inputClass } from "@/components/ui";
import { CARD_COLORS, CARD_PRESETS, type CardPreset } from "@/lib/card-style";
import type { Option } from "../lancamentos/transaction-form";

export function CardFields({
  accounts,
  name = "",
  limit = "",
  closingDay = "",
  dueDay = "",
  accountId,
  color = "",
  style = "",
  lastDigits = "",
}: {
  accounts: Option[];
  name?: string;
  limit?: string;
  closingDay?: string;
  dueDay?: string;
  accountId?: string;
  color?: string;
  style?: string;
  lastDigits?: string;
}) {
  const groups = Object.entries(
    Object.groupBy(Object.entries(CARD_PRESETS), ([, preset]) => preset.group),
  ) as [string, [string, CardPreset][]][];

  return (
    <>
      <Field label="Nome">
        <input
          name="name"
          required
          placeholder="Ex.: Nubank"
          defaultValue={name}
          className={inputClass}
        />
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
      <Field label="Visual do cartão">
        <select
          name="look"
          defaultValue={style ? `style:${style}` : color ? `color:${color}` : ""}
          className={inputClass}
        >
          <option value="">Automático (pelo nome)</option>
          {groups.map(([group, presets]) => (
            <optgroup key={group} label={group}>
              {presets.map(([id, preset]) => (
                <option key={id} value={`style:${id}`}>
                  {preset.label}
                </option>
              ))}
            </optgroup>
          ))}
          <optgroup label="Cor sólida">
            {CARD_COLORS.map((option) => (
              <option key={option.value} value={`color:${option.value}`}>
                {option.label}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>
      <Field label="4 últimos dígitos (opcional)">
        <input
          name="lastDigits"
          inputMode="numeric"
          maxLength={4}
          pattern="[0-9]{4}"
          placeholder="1234"
          defaultValue={lastDigits}
          className={inputClass}
        />
      </Field>
    </>
  );
}
