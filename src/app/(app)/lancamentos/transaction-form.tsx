"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CreditCard,
  Minus,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { BankIcon, type Institution } from "@/components/bank-icon";
import { ActionForm, SubmitButton, type FormAction } from "@/components/forms";
import { inputClass } from "@/components/ui";
import { MAX_INSTALLMENTS } from "@/lib/cards";
import { addDays, formatDate } from "@/lib/dates";
import { centsToInput, formatCents, parseMoneyToCents } from "@/lib/money";
import type { TransactionType } from "@/lib/transactions";

export interface Option extends Institution {
  id: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  kind: "income" | "expense";
  color?: string;
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

const TYPES: { value: FormType; label: string; icon: LucideIcon }[] = [
  { value: "expense", label: "Despesa", icon: ArrowDownLeft },
  { value: "income", label: "Receita", icon: ArrowUpRight },
  { value: "card", label: "Cartão", icon: CreditCard },
  { value: "transfer", label: "Transferência", icon: ArrowLeftRight },
];

const MAX_CENTS = 99_999_999_99;

const sectionLabel = "mb-2 block text-sm font-medium";

export function TransactionForm({
  action,
  accounts,
  categories,
  cards = [],
  initial,
  submitLabel,
  today,
}: {
  action: FormAction;
  accounts: Option[];
  categories: CategoryOption[];
  cards?: Option[];
  initial: TransactionFormValues;
  submitLabel: string;
  /** Data de hoje no Brasil, calculada no servidor. */
  today: string;
}) {
  const [type, setType] = useState<FormType>(initial.type);
  const [cents, setCents] = useState(() =>
    Math.abs(parseMoneyToCents(initial.amount || "0") ?? 0),
  );
  const [date, setDate] = useState(initial.date);
  const [accountId, setAccountId] = useState(initial.accountId);
  const [toAccountId, setToAccountId] = useState(initial.toAccountId);
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [paid, setPaid] = useState(initial.status === "paid");
  const [installments, setInstallments] = useState(1);

  const yesterday = addDays(today, -1);
  const [pickingDate, setPickingDate] = useState(date !== today && date !== yesterday);

  const types = TYPES.filter(({ value }) => value !== "card" || cards.length > 0);
  const categoryKind = type === "card" ? "expense" : type;
  const categoryOptions = categories.filter((c) => c.kind === categoryKind);

  function changeType(next: FormType) {
    setType(next);
    // Categoria de receita não serve para despesa, e vice-versa.
    const kind = next === "card" ? "expense" : next;
    if (!categories.some((c) => c.id === categoryId && c.kind === kind)) setCategoryId("");
  }

  const amountTone = type === "income" ? "text-income" : "text-ink";

  return (
    <ActionForm action={action} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="amount" value={centsToInput(cents)} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="status" value={paid ? "paid" : "pending"} />
      {type === "card" ? (
        <>
          <input type="hidden" name="cardId" value={cardId} />
          <input type="hidden" name="installments" value={installments} />
        </>
      ) : (
        <input type="hidden" name="accountId" value={accountId} />
      )}
      {type === "transfer" ? (
        <input type="hidden" name="toAccountId" value={toAccountId} />
      ) : (
        <input type="hidden" name="categoryId" value={categoryId} />
      )}

      <div
        role="radiogroup"
        aria-label="Tipo de lançamento"
        className="grid grid-cols-2 gap-1 rounded-2xl bg-soft p-1 sm:grid-flow-col sm:grid-cols-none sm:auto-cols-fr"
      >
        {types.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={type === value}
            onClick={() => changeType(value)}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium transition ${
              type === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div className="text-center">
        <label htmlFor="amount-display" className="text-sm text-muted">
          {type === "card" ? "Valor total da compra" : "Valor"}
        </label>
        <div className={`mt-1 flex items-baseline justify-center gap-2 ${amountTone}`}>
          <span className="text-2xl font-medium text-muted">R$</span>
          <input
            id="amount-display"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={formatCents(cents).replace(/^R\$\s?/, "")}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").replace(/^0+/, "");
              setCents(Math.min(Number(digits || 0), MAX_CENTS));
            }}
            className="w-full max-w-[14ch] bg-transparent text-center text-5xl font-semibold tracking-tight tabular-nums outline-none"
            aria-describedby="amount-hint"
          />
        </div>
        <p id="amount-hint" className="mt-1 text-xs text-muted">
          Digite só os números: 1250 vira 12,50
        </p>
      </div>

      <div>
        <label htmlFor="description" className={sectionLabel}>
          Descrição
        </label>
        <input
          id="description"
          name="description"
          required
          maxLength={200}
          defaultValue={initial.description}
          placeholder={
            type === "income" ? "Ex.: Salário" : type === "transfer" ? "Ex.: Reserva" : "Ex.: Mercado"
          }
          className={inputClass}
        />
      </div>

      {type !== "transfer" && (
        <fieldset>
          <legend className={sectionLabel}>Categoria</legend>
          {categoryOptions.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma categoria deste tipo.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((category) => (
                <Chip
                  key={category.id}
                  selected={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: category.color ?? "var(--color-muted)" }}
                    aria-hidden
                  />
                  {category.name}
                </Chip>
              ))}
            </div>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend className={sectionLabel}>
          {type === "card" ? "Cartão" : type === "transfer" ? "Sai de" : "Conta"}
        </legend>
        <SourceList
          options={type === "card" ? cards : accounts}
          selected={type === "card" ? cardId : accountId}
          onSelect={type === "card" ? setCardId : setAccountId}
        />
      </fieldset>

      {type === "transfer" && (
        <fieldset>
          <legend className={sectionLabel}>Vai para</legend>
          <SourceList
            options={accounts.filter((account) => account.id !== accountId)}
            selected={toAccountId}
            onSelect={setToAccountId}
          />
        </fieldset>
      )}

      {type === "card" && (
        <div>
          <span className={sectionLabel}>Parcelas</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-line">
              <button
                type="button"
                aria-label="Menos parcelas"
                onClick={() => setInstallments((n) => Math.max(1, n - 1))}
                className="flex size-10 items-center justify-center rounded-l-xl hover:bg-soft"
              >
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="w-12 text-center font-semibold tabular-nums" aria-live="polite">
                {installments}x
              </span>
              <button
                type="button"
                aria-label="Mais parcelas"
                onClick={() => setInstallments((n) => Math.min(MAX_INSTALLMENTS, n + 1))}
                className="flex size-10 items-center justify-center rounded-r-xl hover:bg-soft"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
            <p className="text-sm text-muted tabular-nums">
              {installments === 1
                ? "À vista"
                : `${installments}x de ${formatCents(Math.floor(cents / installments))}`}
            </p>
          </div>
        </div>
      )}

      <fieldset>
        <legend className={sectionLabel}>Data</legend>
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            selected={!pickingDate && date === today}
            onClick={() => {
              setPickingDate(false);
              setDate(today);
            }}
          >
            Hoje
          </Chip>
          <Chip
            selected={!pickingDate && date === yesterday}
            onClick={() => {
              setPickingDate(false);
              setDate(yesterday);
            }}
          >
            Ontem
          </Chip>
          <Chip selected={pickingDate} onClick={() => setPickingDate(true)}>
            <CalendarDays className="size-4" aria-hidden />
            {pickingDate ? formatDate(date) : "Outra data"}
          </Chip>
        </div>
        {pickingDate && (
          <input
            type="date"
            required
            aria-label="Escolher data"
            value={date}
            onChange={(event) => event.target.value && setDate(event.target.value)}
            className={`${inputClass} mt-2 max-w-48`}
          />
        )}
      </fieldset>

      {type !== "card" && (
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-soft px-4 py-3">
          <span>
            <span className="block text-sm font-medium">
              {type === "income" ? "Já recebi" : "Já paguei"}
            </span>
            <span className="block text-xs text-muted">
              Desligue para deixar como pendente
            </span>
          </span>
          <input
            type="checkbox"
            checked={paid}
            onChange={(event) => setPaid(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-6 w-11 shrink-0 rounded-full bg-line transition peer-checked:bg-bar-income peer-focus-visible:ring-2 peer-focus-visible:ring-ink after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
          />
        </label>
      )}

      <SubmitButton className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-3 text-base font-medium text-on-ink hover:opacity-90 disabled:opacity-60">
        {submitLabel}
      </SubmitButton>
    </ActionForm>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
        selected
          ? "border-ink bg-ink font-medium text-on-ink"
          : "border-line bg-surface hover:bg-soft"
      }`}
    >
      {children}
    </button>
  );
}

function SourceList({
  options,
  selected,
  onSelect,
}: {
  options: Option[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-muted">Nenhuma opção disponível.</p>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const active = option.id === selected;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(option.id)}
            className={`flex items-center gap-3 rounded-xl border p-2.5 text-left text-sm transition ${
              active ? "border-ink ring-1 ring-ink" : "border-line hover:bg-soft"
            }`}
          >
            <BankIcon institution={option} fallbackName={option.name} size={32} />
            <span className="min-w-0 flex-1 truncate">{option.name}</span>
            {active && <Check className="size-4 shrink-0" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
