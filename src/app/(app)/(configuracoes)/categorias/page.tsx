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
  createRule,
  deleteCategory,
  deleteRule,
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
  const [categories, rulesResult] = await Promise.all([
    db.from("categories").select("id, name, kind, color").order("name"),
    db.from("category_rules").select("id, pattern, category_id").order("pattern"),
  ]);
  if (categories.error) throw new Error(categories.error.message);
  if (rulesResult.error) throw new Error(rulesResult.error.message);
  const rows = categories.data as Category[];
  const rules = rulesResult.data as { id: string; pattern: string; category_id: string }[];
  const byId = new Map(rows.map((row) => [row.id, row]));

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

      <Card className="mt-4">
        <h2 className="mb-1 font-semibold">Regras automáticas</h2>
        <p className="mb-3 text-sm text-muted">
          Quando a descrição contém o texto, a categoria é sugerida sozinha na
          revisão do banco e na importação de planilha. Maiúsculas e acentos não
          importam.
        </p>

        {rules.length > 0 && (
          <ul className="mb-4 divide-y divide-line">
            {rules.map((rule) => {
              const category = byId.get(rule.category_id);
              return (
                <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <p className="min-w-0 text-sm">
                    Contém <span className="font-semibold">&quot;{rule.pattern}&quot;</span>{" "}
                    <span className="text-muted">→</span>{" "}
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: category?.color }}
                        aria-hidden
                      />
                      {category?.name ?? "Categoria removida"}
                    </span>
                  </p>
                  <form action={deleteRule.bind(null, rule.id)}>
                    <ConfirmButton
                      message={`Apagar a regra "${rule.pattern}"?`}
                      className={textButtonClass}
                    >
                      Apagar
                    </ConfirmButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <ActionForm action={createRule} className="grid items-end gap-4 sm:grid-cols-[1fr_14rem_auto]">
          <Field label="Se a descrição contém">
            <input name="pattern" required placeholder="Ex.: uber" className={inputClass} />
          </Field>
          <Field label="Usar a categoria">
            <select name="categoryId" required defaultValue="" className={inputClass}>
              <option value="">Selecione</option>
              <optgroup label="Despesas">
                {rows
                  .filter((row) => row.kind === "expense")
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Receitas">
                {rows
                  .filter((row) => row.kind === "income")
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </Field>
          <SubmitButton>Criar regra</SubmitButton>
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
