import Link from "next/link";
import { formatMonth, shiftMonth } from "@/lib/dates";
import { secondaryButtonClass } from "./ui";

/** Navegação entre meses. `query` mantém outros filtros da página ao trocar de mês. */
export function MonthNav({
  basePath,
  month,
  query = {},
}: {
  basePath: string;
  month: string;
  query?: Record<string, string>;
}) {
  const href = (target: string) =>
    `${basePath}?${new URLSearchParams({ ...query, mes: target })}`;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={href(shiftMonth(month, -1))}
        aria-label="Mês anterior"
        className={secondaryButtonClass}
      >
        ‹
      </Link>
      <span className="min-w-36 text-center text-sm font-medium">
        {formatMonth(month)}
      </span>
      <Link
        href={href(shiftMonth(month, 1))}
        aria-label="Próximo mês"
        className={secondaryButtonClass}
      >
        ›
      </Link>
    </div>
  );
}
