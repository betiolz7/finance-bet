import type { BudgetLevel } from "@/lib/dashboard";

export function BudgetStatus({ level }: { level: BudgetLevel }) {
  if (level === "over") {
    return (
      <span className="text-xs font-medium text-expense">▲ Acima do orçamento</span>
    );
  }
  if (level === "warning") {
    return <span className="text-xs font-medium text-pending">● Perto do limite</span>;
  }
  return null;
}
