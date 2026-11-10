import Link from "next/link";
import { formatMonth, shiftMonth } from "@/lib/dates";
import { secondaryButtonClass } from "./ui";

export function MonthNav({ basePath, month }: { basePath: string; month: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`${basePath}?mes=${shiftMonth(month, -1)}`}
        aria-label="Mês anterior"
        className={secondaryButtonClass}
      >
        ‹
      </Link>
      <span className="min-w-36 text-center text-sm font-medium">
        {formatMonth(month)}
      </span>
      <Link
        href={`${basePath}?mes=${shiftMonth(month, 1)}`}
        aria-label="Próximo mês"
        className={secondaryButtonClass}
      >
        ›
      </Link>
    </div>
  );
}
