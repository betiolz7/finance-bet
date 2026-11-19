"use client";

import Link from "next/link";
import { useState } from "react";
import { BankIcon, type Institution } from "@/components/bank-icon";
import { OriginBadge } from "@/components/origin-badge";
import { EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { matchesOrigin, type Origin, type OriginFilter } from "@/lib/transaction-origin";

export interface RecentTransaction {
  id: string;
  description: string;
  date: string;
  type: string;
  status: "paid" | "pending";
  amount_cents: number;
  origin: Origin;
  sourceName: string;
  institution: Institution | null;
}

export const RECENT_LIMIT = 8;

const FILTERS: [OriginFilter, string, string][] = [
  ["todos", "Todas", "Nenhum lançamento neste mês."],
  ["banco", "Do banco", "Nada vindo do banco neste mês."],
  ["meus", "Minhas", "Nada adicionado por você neste mês."],
];

/** Lista do Dashboard. O filtro de origem roda no navegador, sem recarregar a página. */
export function RecentTransactions({
  rows,
  month,
}: {
  rows: RecentTransaction[];
  month: string;
}) {
  const [filter, setFilter] = useState<OriginFilter>("todos");
  const visible = rows.filter((row) => matchesOrigin(row.origin, filter)).slice(0, RECENT_LIMIT);
  const emptyMessage = FILTERS.find(([value]) => value === filter)?.[2] ?? "";

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Transações</h2>
        <Link
          href={`/lancamentos?${new URLSearchParams(
            filter === "todos" ? { mes: month } : { mes: month, origem: filter },
          )}`}
          className="rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-soft"
        >
          Ver todas
        </Link>
      </div>

      <div role="radiogroup" aria-label="Origem das transações" className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-full border px-2.5 py-1 text-xs transition ${
              filter === value
                ? "border-ink bg-ink font-medium text-on-ink"
                : "border-line hover:bg-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex justify-between border-b border-line pb-2 text-xs text-muted">
        <span>Nome</span>
        <span>Valor</span>
      </div>

      {visible.length === 0 ? (
        <EmptyState message={emptyMessage} href="/lancamentos/novo" linkLabel="Criar lançamento" />
      ) : (
        <ul>
          {visible.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-3">
              <BankIcon institution={row.institution} fallbackName={row.sourceName || row.description} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{row.description}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
                  <span>
                    {formatDate(row.date)} · {row.sourceName}
                  </span>
                  <OriginBadge origin={row.origin} />
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm tabular-nums">
                  {row.type === "income" ? "+ " : row.type === "expense" ? "- " : ""}
                  {formatCents(row.amount_cents)}
                </p>
                <p className={`text-xs ${row.status === "pending" ? "text-pending" : "text-income"}`}>
                  {row.status === "pending" ? "Pendente" : "Pago"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
