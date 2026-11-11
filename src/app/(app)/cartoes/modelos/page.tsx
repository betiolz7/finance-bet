import Link from "next/link";
import { CreditCardVisual } from "@/components/credit-card-visual";
import { Card, PageHeader, secondaryButtonClass } from "@/components/ui";
import { CARD_COLORS, CARD_PRESETS } from "@/lib/card-style";
import { requireDb } from "@/lib/supabase/server";

/** Galeria só de visualização: nenhum cartão de exemplo é gravado. */
export default async function CardModelsPage() {
  await requireDb();

  const groups = Object.entries(
    Object.groupBy(Object.entries(CARD_PRESETS), ([, preset]) => preset.group),
  );

  return (
    <>
      <PageHeader
        title="Modelos de cartão"
        action={
          <Link href="/cartoes" className={secondaryButtonClass}>
            Voltar para Cartões
          </Link>
        }
      />
      <p className="mb-5 max-w-2xl text-sm text-muted">
        Exemplos com dados fictícios. Para usar um modelo, abra o cartão em
        Cartões, clique em Editar e escolha o Visual do cartão.
      </p>

      {groups.map(([group, presets]) => (
        <Card key={group} className="mb-4">
          <h2 className="mb-4 text-lg font-medium">{group}</h2>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
            {(presets ?? []).map(([id, preset]) => (
              <li key={id}>
                <CreditCardVisual
                  card={{
                    name: preset.label.replace(/\s*\(.*\)$/, ""),
                    style: id,
                    last_digits: "4821",
                  }}
                />
                <p className="mt-2 text-sm">{preset.label}</p>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <Card>
        <h2 className="mb-1 text-lg font-medium">Cor sólida</h2>
        <p className="mb-4 text-sm text-muted">
          Para bancos sem modelo próprio. O nome do banco vem do nome do cartão.
        </p>
        <ul className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
          {CARD_COLORS.map((color) => (
            <li key={color.value}>
              <CreditCardVisual
                card={{ name: "Meu banco", color: color.value }}
              />
              <p className="mt-2 text-sm">{color.label}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
