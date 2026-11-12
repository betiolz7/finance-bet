import Link from "next/link";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { Card, EmptyState, PageHeader, textButtonClass } from "@/components/ui";
import { todayInBrazil } from "@/lib/dates";
import { loadGoalBalances } from "@/lib/goal-balances-server";
import { countGoalsByAccount, goalProgress } from "@/lib/goals";
import { requireDb } from "@/lib/supabase/server";
import { loadFormOptions } from "../lancamentos/queries";
import { createGoal, deleteGoal } from "./actions";
import { GoalFields } from "./goal-fields";
import { GoalMeter } from "./goal-meter";

interface Goal {
  id: string;
  name: string;
  target_cents: number;
  deadline: string;
  account_id: string | null;
  investment_id: string | null;
  investment_name: string | null;
  account: { name: string } | null;
}

export default async function GoalsPage() {
  const db = await requireDb();
  const [goals, options] = await Promise.all([
    db
      .from("goals")
      .select(
        "id, name, target_cents, deadline, account_id, investment_id, investment_name, account:accounts(name)",
      )
      .order("deadline"),
    loadFormOptions(),
  ]);
  if (goals.error) throw new Error(goals.error.message);

  const rows = goals.data as unknown as Goal[];
  // A lista de investimentos também serve para o formulário de nova meta.
  const { balances, investments } = await loadGoalBalances(db, { withInvestments: true });
  const counts = countGoalsByAccount(rows);
  const today = todayInBrazil();

  return (
    <>
      <PageHeader title="Metas" />

      <Card className="mb-4">
        {rows.length === 0 ? (
          <EmptyState message="Nenhuma meta cadastrada ainda." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((goal) => {
              const progress = goalProgress(goal, balances, counts, today);
              return (
                <li key={goal.id} className="py-4">
                  <GoalMeter
                    name={goal.name}
                    targetCents={goal.target_cents}
                    deadline={goal.deadline}
                    progress={progress}
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <p className="text-xs text-muted">
                      {goal.investment_id
                        ? `Investimento: ${goal.investment_name ?? "não encontrado"}`
                        : goal.account?.name}
                      {progress.sharedAccount &&
                        " · Usado por outra meta, e o saldo conta nas duas."}
                    </p>
                    <div className="flex items-center gap-3">
                      <Link href={`/metas/${goal.id}/editar`} className={textButtonClass}>
                        Editar
                      </Link>
                      <form action={deleteGoal.bind(null, goal.id)}>
                        <ConfirmButton
                          message={`Apagar a meta "${goal.name}"? O dinheiro e a conta não são alterados.`}
                          className={textButtonClass}
                        >
                          Apagar
                        </ConfirmButton>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Nova meta</h2>
        <p className="mb-3 text-sm text-muted">
          O progresso é o saldo da conta ou do investimento escolhido. Um
          investimento separado, como um CDB para a reserva, acompanha a meta
          sozinho.
        </p>
        {options.accounts.length === 0 && investments.length === 0 ? (
          <EmptyState
            message="Conecte seu banco antes de criar uma meta."
            href="/open-finance"
            linkLabel="Conectar banco"
          />
        ) : (
          <ActionForm action={createGoal} className="grid items-end gap-4 sm:grid-cols-2">
            <GoalFields accounts={options.accounts} investments={investments} />
            <SubmitButton>Adicionar</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </>
  );
}
