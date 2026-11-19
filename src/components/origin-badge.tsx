import { Landmark, PenLine } from "lucide-react";
import { ORIGIN_LABEL, type Origin } from "@/lib/transaction-origin";

/** Etiqueta de origem: o que veio do banco fica destacado do que você adicionou. */
export function OriginBadge({ origin }: { origin: Origin }) {
  if (origin === "bank") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-income">
        <Landmark className="size-3" aria-hidden />
        {ORIGIN_LABEL.bank}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-soft px-1.5 py-0.5 text-xs font-medium text-ink">
      <PenLine className="size-3" aria-hidden />
      {ORIGIN_LABEL[origin]}
    </span>
  );
}
