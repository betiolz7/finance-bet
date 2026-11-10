"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Card,
  Field,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import {
  MAX_IMPORT_LINES,
  buildCategorySuggestions,
  buildDuplicateIndex,
  decodeCsv,
  isPossibleDuplicate,
  isTotalLine,
  lineError,
  normalizeName,
  parseCsv,
  parseImportAmount,
  parseSheetRows,
  type ExpenseHistoryItem,
} from "@/lib/import";
import { formatCents } from "@/lib/money";
import type { CategoryOption, Option } from "../lancamentos/transaction-form";
import { confirmImport } from "./actions";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface PreviewLine {
  key: number;
  name: string;
  amount: string;
  categoryId: string;
  included: boolean;
}

async function readRows(file: File): Promise<unknown[][]> {
  if (/\.csv$/i.test(file.name)) {
    return parseCsv(decodeCsv(new Uint8Array(await file.arrayBuffer())));
  }
  const { readSheet } = await import("read-excel-file/universal");
  return readSheet(file);
}

export function ImportWizard({
  accounts,
  categories,
  cards,
  history,
  today,
}: {
  accounts: Option[];
  categories: CategoryOption[];
  cards: Option[];
  history: ExpenseHistoryItem[];
  today: string;
}) {
  const [lines, setLines] = useState<PreviewLine[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [date, setDate] = useState(today);
  const [destination, setDestination] = useState(`account:${accounts[0].id}`);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const duplicates = useMemo(() => buildDuplicateIndex(history), [history]);
  const suggestions = useMemo(() => buildCategorySuggestions(history), [history]);

  function suggestCategory(name: string): string {
    const previous = suggestions.get(normalizeName(name));
    if (previous && expenseCategories.some((c) => c.id === previous)) {
      return previous;
    }
    const fallback = expenseCategories.find(
      (c) => normalizeName(c.name) === "imprevistos",
    );
    return fallback?.id ?? "";
  }

  async function handleFile(file: File) {
    setError(undefined);
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setError("Envie um arquivo .xlsx ou .csv.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("O arquivo é grande demais. O limite é 5 MB.");
      return;
    }

    let rows: unknown[][];
    try {
      rows = await readRows(file);
    } catch {
      setError("Não foi possível ler este arquivo. Confira se ele não está corrompido.");
      return;
    }

    const parsed = parseSheetRows(rows);
    if (parsed.length === 0) {
      setError("Nenhuma linha encontrada na planilha.");
      return;
    }
    if (parsed.length > MAX_IMPORT_LINES) {
      setError(`A planilha tem mais de ${MAX_IMPORT_LINES} linhas.`);
      return;
    }

    setFileName(file.name);
    setLines(
      parsed.map((line, key) => ({
        ...line,
        key,
        categoryId: suggestCategory(line.name),
      })),
    );
  }

  function updateLine(key: number, change: Partial<PreviewLine>) {
    setLines((current) =>
      current &&
      current.map((line) => (line.key === key ? { ...line, ...change } : line)),
    );
  }

  if (!lines) {
    return (
      <Card className="mb-4">
        <Field label="Planilha com duas colunas, nome e valor (.xlsx ou .csv)">
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
            className={`${inputClass} cursor-pointer`}
          />
        </Field>
        {error && (
          <p role="alert" className="mt-3 text-sm text-expense">
            {error}
          </p>
        )}
      </Card>
    );
  }

  const importable = lines.filter((line) => line.included && !lineError(line));
  const totalCents = importable.reduce(
    (sum, line) => sum + (parseImportAmount(line.amount) ?? 0),
    0,
  );

  function submit() {
    setError(undefined);
    const [kind, destinationId] = destination.split(":");
    startTransition(async () => {
      const result = await confirmImport({
        fileName,
        date,
        accountId: kind === "account" ? destinationId : "",
        cardId: kind === "card" ? destinationId : undefined,
        lines: importable.map(({ name, amount, categoryId }) => ({
          name,
          amount,
          categoryId,
        })),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium">{fileName}</p>
          <button
            type="button"
            onClick={() => {
              setLines(null);
              setError(undefined);
            }}
            className={secondaryButtonClass}
          >
            Trocar arquivo
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data dos gastos">
            <input
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Conta ou cartão">
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              className={inputClass}
            >
              <optgroup label="Contas">
                {accounts.map((account) => (
                  <option key={account.id} value={`account:${account.id}`}>
                    {account.name}
                  </option>
                ))}
              </optgroup>
              {cards.length > 0 && (
                <optgroup label="Cartões">
                  {cards.map((card) => (
                    <option key={card.id} value={`card:${card.id}`}>
                      {card.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-1 font-semibold">Revise antes de importar</h2>
        <p className="mb-2 text-sm text-muted">
          Nada foi salvo ainda. Desmarque as linhas que não quer importar.
        </p>
        <ul className="divide-y divide-line">
          {lines.map((line) => {
            const problem = lineError(line);
            const duplicate = isPossibleDuplicate(
              duplicates,
              date,
              line.name,
              line.amount,
            );
            return (
              <li key={line.key} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Importar ${line.name}`}
                    checked={line.included}
                    onChange={(event) =>
                      updateLine(line.key, { included: event.target.checked })
                    }
                    className="size-4 shrink-0 accent-ink"
                  />
                  <input
                    aria-label="Nome"
                    value={line.name}
                    onChange={(event) =>
                      updateLine(line.key, { name: event.target.value })
                    }
                    className={`${inputClass} min-w-40 flex-1 basis-48 py-1`}
                  />
                  <input
                    aria-label="Valor"
                    inputMode="decimal"
                    value={line.amount}
                    onChange={(event) =>
                      updateLine(line.key, { amount: event.target.value })
                    }
                    className={`${inputClass} w-28 py-1 text-right tabular-nums`}
                  />
                  <select
                    aria-label="Categoria"
                    value={line.categoryId}
                    onChange={(event) =>
                      updateLine(line.key, { categoryId: event.target.value })
                    }
                    className={`${inputClass} min-w-36 flex-1 basis-36 py-1`}
                  >
                    <option value="">Selecione</option>
                    {expenseCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                {line.included && problem && (
                  <p className="mt-1 pl-6 text-xs text-expense">{problem}</p>
                )}
                {line.included && !problem && duplicate && (
                  <p className="mt-1 pl-6 text-xs font-medium text-pending">
                    Possível duplicada: já existe um gasto igual neste mês.
                  </p>
                )}
                {!line.included && isTotalLine(line.name) && (
                  <p className="mt-1 pl-6 text-xs text-muted">
                    Parece uma linha de total, por isso veio desmarcada.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{formatCents(totalCents)}</span>
            <span className="text-muted">
              {" "}
              em {importable.length}{" "}
              {importable.length === 1 ? "linha válida" : "linhas válidas"}
            </span>
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={pending || importable.length === 0 || !date}
            className={primaryButtonClass}
          >
            {pending ? "Importando..." : "Confirmar importação"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-expense">
            {error}
          </p>
        )}
      </Card>
    </>
  );
}
