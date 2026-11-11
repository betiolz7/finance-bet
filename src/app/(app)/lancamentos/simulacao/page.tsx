import Link from "next/link";
import { BankIcon, type Institution } from "@/components/bank-icon";
import { Card, PageHeader, secondaryButtonClass } from "@/components/ui";
import { normalizeColor, safeLogoUrl } from "@/lib/connected-accounts";
import { addDays, formatDate, todayInBrazil } from "@/lib/dates";
import { normalizeName } from "@/lib/import";
import { formatCents } from "@/lib/money";
import { isPluggyConfigured, listBankConnectors } from "@/lib/pluggy";
import { requireDb } from "@/lib/supabase/server";

// Transações fictícias, só para visualizar os ícones. Nada é gravado.
const SAMPLES = [
  { bank: "Inter", source: "Conta Inter", description: "iFood", category: "Alimentação", cents: 4790, type: "expense" },
  { bank: "Nubank", source: "Nubank", description: "Uber", category: "Transporte", cents: 2315, type: "expense" },
  { bank: "XP", source: "XP Visa Infinite", description: "Amazon", category: "Imprevistos", cents: 18990, type: "expense" },
  { bank: "Itaú", source: "Conta Itaú", description: "Salário", category: "Salário", cents: 850000, type: "income" },
  { bank: "C6", source: "C6 Carbon", description: "Netflix", category: "Assinaturas", cents: 5590, type: "expense" },
  { bank: "Bradesco", source: "Conta Bradesco", description: "Conta de luz", category: "Moradia", cents: 21430, type: "expense" },
  { bank: "Santander", source: "Santander Free", description: "Farmácia", category: "Saúde", cents: 6780, type: "expense" },
  { bank: "Banco do Brasil", source: "Conta BB", description: "Pix recebido", category: "Renda extra", cents: 30000, type: "income" },
  { bank: "Caixa", source: "Conta Caixa", description: "Aluguel", category: "Moradia", cents: 150000, type: "expense" },
  { bank: "Mercado Pago", source: "Mercado Pago", description: "Mercado Livre", category: "Imprevistos", cents: 12900, type: "expense" },
  { bank: "PicPay", source: "PicPay", description: "Cinema", category: "Lazer", cents: 6400, type: "expense" },
  { bank: "BTG", source: "BTG Pactual", description: "Curso online", category: "Educação", cents: 29700, type: "expense" },
] as const;

async function loadInstitutions(): Promise<Map<string, Institution>> {
  const result = new Map<string, Institution>();
  if (!isPluggyConfigured()) return result;
  try {
    const connectors = await listBankConnectors();
    for (const { bank } of SAMPLES) {
      const wanted = normalizeName(bank);
      const match =
        connectors.find((c) => normalizeName(c.name) === wanted) ??
        connectors.find((c) => normalizeName(c.name).startsWith(wanted));
      if (match) {
        result.set(bank, {
          institution_name: match.name,
          institution_logo: safeLogoUrl(match.imageUrl),
          institution_color: normalizeColor(match.primaryColor),
        });
      }
    }
  } catch {
    // Sem Pluggy, a simulação mostra as iniciais.
  }
  return result;
}

export default async function TransactionsSimulationPage() {
  await requireDb();
  const institutions = await loadInstitutions();
  const today = todayInBrazil();
  const withLogo = SAMPLES.filter((s) => institutions.get(s.bank)?.institution_logo).length;

  return (
    <>
      <PageHeader
        title="Simulação de transações"
        action={
          <Link href="/lancamentos" className={secondaryButtonClass}>
            Voltar para Lançamentos
          </Link>
        }
      />
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Transações fictícias para ver os ícones de cada banco. Nada foi gravado.
        {" "}
        {withLogo === 0
          ? "Não foi possível buscar os ícones na Pluggy, então aparecem as iniciais."
          : `${withLogo} de ${SAMPLES.length} bancos com ícone fornecido pela Pluggy. Os demais aparecem com as iniciais.`}
      </p>

      <Card>
        <ul className="divide-y divide-line">
          {SAMPLES.map((sample, index) => (
            <li
              key={sample.bank}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
            >
              <BankIcon institution={institutions.get(sample.bank)} fallbackName={sample.bank} />
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium">{sample.description}</p>
                <p className="text-xs text-muted">
                  {formatDate(addDays(today, -Math.floor(index / 2)))} · {sample.category} ·{" "}
                  {sample.source}
                </p>
              </div>
              <p
                className={`whitespace-nowrap text-sm font-semibold tabular-nums ${
                  sample.type === "income" ? "text-income" : "text-expense"
                }`}
              >
                {sample.type === "income" ? "+ " : "- "}
                {formatCents(sample.cents)}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
