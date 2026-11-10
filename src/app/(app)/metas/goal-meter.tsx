import { formatDate } from "@/lib/dates";
import type { GoalProgress } from "@/lib/goals";
import { formatCents } from "@/lib/money";

export function GoalMeter({
  name,
  targetCents,
  deadline,
  progress,
}: {
  name: string;
  targetCents: number;
  deadline: string;
  progress: GoalProgress;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="min-w-0 truncate text-sm font-medium">{name}</p>
        <p className="text-sm tabular-nums">
          <span className="font-semibold">{formatCents(progress.savedCents)}</span>
          <span className="text-muted"> de {formatCents(targetCents)}</span>
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas">
        <div
          className="h-full rounded-full bg-chart"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted tabular-nums">
        <span>Prazo {formatDate(deadline)}</span>
        {progress.status === "active" && (
          <span>Guardar {formatCents(progress.monthlyCents)} por mês</span>
        )}
        {progress.status === "reached" && (
          <span className="font-medium text-income">✓ Meta alcançada</span>
        )}
        {progress.status === "overdue" && (
          <span className="font-medium text-expense">
            ▲ Prazo vencido, faltam {formatCents(progress.remainingCents)}
          </span>
        )}
      </p>
    </div>
  );
}
