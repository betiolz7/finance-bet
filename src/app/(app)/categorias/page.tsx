import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import {
  Card,
  Field,
  PageHeader,
  inputClass,
  secondaryButtonClass,
  textButtonClass,
} from "@/components/ui";
import { requireDb } from "@/lib/supabase/server";
import {
  createCategory,
  createDefaultCategories,
  deleteCategory,
  updateCategory,
} from "./actions";

interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
  color: string;
}

export default async function CategoriesPage() {
  const db = await requireDb();
  const { data, error } = await db
    .from("categories")
    .select("id, name, kind, color")
    .order("name");
  if (error) throw new Error(error.message);
  const rows = data as Category[];

  return (
    <>
      <PageHeader title="Categorias" />

      {rows.length === 0 && (
        <Card className="mb-4 text-center">
          <p className="mb-3 text-sm text-muted">
            Comece com uma lista pronta e ajuste depois.
          </p>
          <form action={createDefaultCategories}>
            <button type="submit" className={secondaryButtonClass}>
              Criar categorias padrão
            </button>
          </form>
        </Card>
      )}

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <CategoryList title="Despesas" rows={rows.filter((r) => r.kind === "expense")} />
        <CategoryList title="Receitas" rows={rows.filter((r) => r.kind === "income")} />
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Nova categoria</h2>
        <ActionForm
          action={createCategory}
          className="grid items-end gap-4 sm:grid-cols-[1fr_10rem_4rem_auto]"
        >
          <Field label="Nome">
            <input name="name" required className={inputClass} />
          </Field>
          <Field label="Tipo">
            <select name="kind" defaultValue="expense" className={inputClass}>
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </Field>
          <Field label="Cor">
            <input
              name="color"
              type="color"
              defaultValue="#9bcf53"
              className="h-9.5 w-full cursor-pointer rounded-lg border border-line bg-surface p-1"
            />
          </Field>
          <SubmitButton>Adicionar</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}

function CategoryList({ title, rows }: { title: string; rows: Category[] }) {
  return (
    <Card>
      <h2 className="mb-2 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-3 text-sm text-muted">Nenhuma categoria.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2 py-2">
              <ActionForm
                action={updateCategory.bind(null, row.id)}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
              >
                <input
                  name="color"
                  type="color"
                  aria-label={`Cor de ${row.name}`}
                  defaultValue={row.color}
                  className="size-7 shrink-0 cursor-pointer rounded border border-line bg-surface p-0.5"
                />
                <input
                  name="name"
                  required
                  aria-label="Nome da categoria"
                  defaultValue={row.name}
                  className={`${inputClass} min-w-0 flex-1 py-1`}
                />
                <SubmitButton className={textButtonClass}>Salvar</SubmitButton>
              </ActionForm>
              <ActionForm action={deleteCategory.bind(null, row.id)}>
                <ConfirmButton
                  message={`Apagar a categoria "${row.name}"?`}
                  className={textButtonClass}
                >
                  Apagar
                </ConfirmButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
