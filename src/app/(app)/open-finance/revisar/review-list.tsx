"use client";

import { useState, useTransition } from "react";
import { inputClass, primaryButtonClass } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { ReviewItem } from "@/lib/open-finance";
import type { CategoryOption } from "../../lancamentos/transaction-form";
import { applyReview } from "../actions";

interface Decision {
  choice: string;
  categoryId: string;
}

export function ReviewList({
  items,
  categories,
}: {
  items: ReviewItem[];
  categories: CategoryOption[];
}) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.id,
        { choice: item.defaultChoice, categoryId: item.defaultCategoryId },
      ]),
    ),
  );
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function update(id: string, change: Partial<Decision>) {
    setDecisions((current) => ({
      ...current,
      [id]: { ...current[id], ...change },
    }));
  }

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await applyReview(
        items.map((item) => ({ id: item.id, ...decisions[item.id] })),
      );
      if (result.error) setError(result.error);
    });
  }

  const counts = { create: 0, match: 0, ignore: 0 };
  for (const item of items) {
    const { choice } = decisions[item.id] ?? { choice: "ignore" };
    counts[choice.startsWith("match:") ? "match" : (choice as "create" | "ignore")]++;
  }

  return (
    <>
      <ul className="divide-y divide-line">
        {items.map((item) => {
          const decision = decisions[item.id];
          if (!decision) return null;
          return (
            <li key={item.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="min-w-0 flex-1 basis-48 truncate text-sm font-medium">
                  {item.description}
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {item.direction === "credit" ? "+ " : "- "}
                  {formatCents(item.amount_cents)}
                </p>
              </div>
              <p className="text-xs text-muted">
                {formatDate(item.date)} · {item.linkName}
                {item.pluggy_status === "PENDING" && " · Pendente no banco"}
              </p>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select
                  aria-label={`Ação para ${item.description}`}
                  value={decision.choice}
                  onChange={(event) => update(item.id, { choice: event.target.value })}
                  className={`${inputClass} py-1`}
                >
                  {item.canCreate && (
                    <option value="create">
                      {item.kind === "income" ? "Lançar como receita" : "Lançar como despesa"}
                    </option>
                  )}
                  {item.candidates.map((candidate) => (
                    <option key={candidate.id} value={`match:${candidate.id}`}>
                      Dar baixa em: {candidate.description}
                    </option>
                  ))}
                  <option value="ignore">Ignorar</option>
                </select>

                {decision.choice === "create" && (
                  <select
                    aria-label={`Categoria de ${item.description}`}
                    value={decision.categoryId}
                    onChange={(event) =>
                      update(item.id, { categoryId: event.target.value })
                    }
                    className={`${inputClass} py-1`}
                  >
                    <option value="">Selecione a categoria</option>
                    {categories
                      .filter((category) => category.kind === item.kind)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {item.note && (
                <p className="mt-1 text-xs font-medium text-pending">{item.note}</p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-muted">
          {counts.create} a lançar · {counts.match} a dar baixa · {counts.ignore} a ignorar
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className={primaryButtonClass}
        >
          {pending ? "Aplicando..." : "Confirmar revisão"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-expense">
          {error}
        </p>
      )}
    </>
  );
}
