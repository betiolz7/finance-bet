import type { DailyPoint } from "@/lib/dashboard";
import { formatDate } from "@/lib/dates";
import { formatCents, formatCompactCents } from "@/lib/money";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function weekday(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/** Receitas acima da linha do zero e despesas abaixo, um par de barras por dia. */
export function OverviewChart({ points }: { points: DailyPoint[] }) {
  const maxIncome = Math.max(0, ...points.map((p) => p.incomeCents));
  const maxExpense = Math.max(0, ...points.map((p) => p.expenseCents));
  const range = maxIncome + maxExpense;

  if (range === 0) {
    return (
      <p className="flex h-[240px] items-center justify-center text-sm text-muted">
        Nenhuma receita ou despesa nestes 7 dias.
      </p>
    );
  }

  const zero = (maxIncome / range) * 100;
  const height = (cents: number) =>
    cents > 0 ? `max(2px, ${(cents / range) * 100}%)` : "0";

  return (
    <figure>
      <figcaption className="sr-only">
        Receitas e despesas por dia nos últimos 7 dias
      </figcaption>
      <div className="relative ml-16 h-[220px]">
        <GridLine top="0%" label={formatCompactCents(maxIncome)} />
        <GridLine top={`${zero}%`} label="R$ 0" strong />
        <GridLine top="100%" label={`-${formatCompactCents(maxExpense)}`} />

        <div className="absolute inset-0 flex gap-2">
          {points.map((point) => (
            <div
              key={point.date}
              tabIndex={0}
              className="group relative flex-1 outline-none"
              aria-label={`${formatDate(point.date)}: receitas ${formatCents(point.incomeCents)}, despesas ${formatCents(point.expenseCents)}`}
            >
              <div
                className="hatch absolute inset-x-[18%] rounded-t bg-bar-income"
                style={{ bottom: `${100 - zero}%`, height: height(point.incomeCents) }}
              />
              <div
                className="hatch absolute inset-x-[18%] rounded-b bg-bar-expense"
                style={{ top: `${zero}%`, height: height(point.expenseCents) }}
              />
              <div className="pointer-events-none absolute top-0 left-1/2 z-10 hidden w-max -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded-xl bg-surface p-3 text-xs shadow-lg ring-1 ring-line group-hover:block group-focus-visible:block">
                <p className="mb-1 text-muted">{formatDate(point.date)}</p>
                <p className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-bar-income" aria-hidden />
                  Receitas
                  <span className="ml-auto pl-3 font-medium tabular-nums">
                    {formatCents(point.incomeCents)}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-bar-expense" aria-hidden />
                  Despesas
                  <span className="ml-auto pl-3 font-medium tabular-nums">
                    {formatCents(point.expenseCents)}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 ml-16 flex gap-2 text-xs text-muted">
        {points.map((point) => (
          <span key={point.date} className="flex-1 text-center">
            {weekday(point.date)}
          </span>
        ))}
      </div>
    </figure>
  );
}

function GridLine({
  top,
  label,
  strong = false,
}: {
  top: string;
  label: string;
  strong?: boolean;
}) {
  return (
    <div className="absolute inset-x-0" style={{ top }}>
      <div className={`border-t ${strong ? "border-ink/25" : "border-line"}`} />
      <span className="absolute -left-16 w-14 -translate-y-1/2 text-right text-[11px] text-muted tabular-nums">
        {label}
      </span>
    </div>
  );
}

export function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-bar-income" aria-hidden />
        Receitas
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-bar-expense" aria-hidden />
        Despesas
      </span>
    </div>
  );
}
