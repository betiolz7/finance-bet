import Link from "next/link";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { Card, EmptyState, PageHeader, textButtonClass } from "@/components/ui";
import { todayInBrazil } from "@/lib/dates";
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
  account_id: string;
  account: { name: string };
}

export default async function GoalsPage() {
  const db = await requireDb();
  const [goals, balances, options] = await Promise.all([
    db
      .from("goals")
      .select("id, name, target_cents, deadline, account_id, account:accounts(name)")
      .order("deadline"),
    db.from("account_balances").select("id, balance_cents"),
    loadFormOptions(),
  ]);
  if (goals.error) throw new Error(goals.error.message);
  if (balances.error) throw new Error(balances.error.message);

  const rows = goals.data as unknown as Goal[];
  const balanceById = new Map(
    (balances.data as { id: string; balance_cents: number }[]).map((row) => [
      row.id,
      row.balance_cents,
    ]),
  );
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
              const progress = goalProgress(goal, balanceById, counts, today);
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
                      {goal.account.name}
                      {progress.sharedAccount &&
                        " · Esta conta é usada por outra meta, e o saldo conta nas duas."}
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
          O progresso é o saldo da conta escolhida. Use uma conta separada para
          cada meta, como uma poupança ou investimento.
        </p>
        {options.accounts.length === 0 ? (
          <EmptyState
            message="Cadastre uma conta antes de criar uma meta."
            href="/contas"
            linkLabel="Cadastrar conta"
          />
        ) : (
          <ActionForm
            action={createGoal}
            className="grid items-end gap-4 sm:grid-cols-2"
          >
            <GoalFields accounts={options.accounts} />
            <SubmitButton>Adicionar</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </>
  );
}
