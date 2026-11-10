"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, type FormAction } from "@/components/forms";
import { Field, inputClass } from "@/components/ui";
import { MAX_INSTALLMENTS } from "@/lib/cards";
import type { TransactionType } from "@/lib/transactions";

export interface Option {
  id: string;
  name: string;
}

export interface CategoryOption extends Option {
  kind: "income" | "expense";
}

export interface TransactionFormValues {
  type: TransactionType;
  status: "pending" | "paid";
  amount: string;
  date: string;
  description: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
}

type FormType = TransactionType | "card";

const TYPES: { value: FormType; label: string }[] = [
  { value: "expense", label: "Despesa" },
  { value: "card", label: "Cartão" },
  { value: "income", label: "Receita" },
  { value: "transfer", label: "Transferência" },
];

export function TransactionForm({
  action,
  accounts,
  categories,
  cards = [],
  initial,
  submitLabel,
}: {
  action: FormAction;
  accounts: Option[];
  categories: CategoryOption[];
  cards?: Option[];
  initial: TransactionFormValues;
  submitLabel: string;
}) {
  const [type, setType] = useState<FormType>(initial.type);
  const categoryKind = type === "card" ? "expense" : type;
  const options = categories.filter((category) => category.kind === categoryKind);
  const types = TYPES.filter(({ value }) => value !== "card" || cards.length > 0);

  return (
    <ActionForm action={action} className="space-y-4">
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Tipo</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-flow-col sm:grid-cols-none sm:auto-cols-fr">
          {types.map(({ value, label }) => (
            <label
              key={value}
              className="cursor-pointer rounded-lg border border-line px-2 py-2 text-center text-sm font-medium has-checked:border-ink has-checked:bg-brand-soft has-focus-visible:border-ink"
            >
              <input
                type="radio"
                name="type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={type === "card" ? "Valor total (R$)" : "Valor (R$)"}>
          <input
            name="amount"
            inputMode="decimal"
            required
            autoFocus
            placeholder="0,00"
            defaultValue={initial.amount}
            className={inputClass}
          />
        </Field>
        <Field label="Data">
          <input
            name="date"
            type="date"
            required
            defaultValue={initial.date}
            className={inputClass}
          />
        </Field>
      </div>

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
        {type === "card" ? (
          <Field label="Cartão">
            <select name="cardId" required className={inputClass}>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label={type === "transfer" ? "Conta de origem" : "Conta"}>
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
        )}

        {type === "transfer" ? (
          <Field label="Conta de destino">
            <select
              name="toAccountId"
              required
              defaultValue={initial.toAccountId}
              className={inputClass}
            >
              <option value="">Selecione</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Categoria">
            <select
              key={type}
              name="categoryId"
              required
              defaultValue={initial.type === type ? initial.categoryId : ""}
              className={inputClass}
            >
              <option value="">Selecione</option>
              {options.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {type === "card" ? (
        <Field label="Parcelas">
          <input
            name="installments"
            type="number"
            min={1}
            max={MAX_INSTALLMENTS}
            required
            defaultValue={1}
            className={inputClass}
          />
        </Field>
      ) : (
        <Field label="Situação">
          <select name="status" defaultValue={initial.status} className={inputClass}>
            <option value="paid">Pago</option>
            <option value="pending">Pendente</option>
          </select>
        </Field>
      )}

      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
