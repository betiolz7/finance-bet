import { parseMoneyToCents } from "./money";
import type { PluggyInvestment } from "./pluggy";

// Ordem fixa: cada tipo tem sempre a mesma cor. Paleta categórica validada
// para daltonismo, nos sete primeiros espaços.
export const INVESTMENT_TYPES = [
  { type: "FIXED_INCOME", label: "Renda fixa", color: "#2a78d6" },
  { type: "MUTUAL_FUND", label: "Fundos", color: "#eb6834" },
  { type: "EQUITY", label: "Ações", color: "#1baf7a" },
  { type: "ETF", label: "ETFs", color: "#eda100" },
  { type: "SECURITY", label: "Previdência", color: "#e87ba4" },
  { type: "COE", label: "COE", color: "#008300" },
  { type: "OTHER", label: "Outros", color: "#6250d6" },
] as const;

const SUBTYPE_LABELS: Record<string, string> = {
  TREASURY: "Tesouro Direto",
  CDB: "CDB",
  LCI: "LCI",
  LCA: "LCA",
  LC: "LC",
  LF: "LF",
  LIG: "LIG",
  CRI: "CRI",
  CRA: "CRA",
  DEBENTURES: "Debêntures",
  CORPORATE_DEBT: "Crédito privado",
  STOCK: "Ação",
  BDR: "BDR",
  REAL_ESTATE_FUND: "Fundo imobiliário",
  ETF: "ETF",
  INVESTMENT_FUND: "Fundo de investimento",
  MULTIMARKET_FUND: "Fundo multimercado",
  FIXED_INCOME_FUND: "Fundo de renda fixa",
  STOCK_FUND: "Fundo de ações",
  ETF_FUND: "Fundo de ETF",
  OFFSHORE_FUND: "Fundo no exterior",
  FIP_FUND: "FIP",
  EXCHANGE_FUND: "Fundo cambial",
  FI_INFRA: "Fundo de infraestrutura",
  FI_AGRO: "Fiagro",
  PGBL: "PGBL",
  VGBL: "VGBL",
  RETIREMENT: "Previdência",
  STRUCTURED_NOTE: "COE",
  DERIVATIVES: "Derivativos",
  OPTION: "Opção",
};

const RATE_TYPE_LABELS: Record<string, string> = {
  CDI: "CDI",
  SELIC: "Selic",
  IPCA: "IPCA",
  IGPM: "IGP-M",
  DOLAR: "Dólar",
  EURO: "Euro",
};

export interface Investment {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  detail: string;
  currencyCode: string;
  balanceCents: number;
  investedCents: number | null;
  profitCents: number | null;
  dueDate: string | null;
}

function cents(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : parseMoneyToCents(value);
}

function knownType(type: string): string {
  return INVESTMENT_TYPES.some((t) => t.type === type) ? type : "OTHER";
}

/** Investimentos já resgatados por completo saem da carteira. */
export function mapInvestments(raw: PluggyInvestment[]): Investment[] {
  return raw
    .filter((item) => item.status !== "TOTAL_WITHDRAWAL")
    .map((item) => {
      const type = knownType(item.type);
      const detail = [
        item.subtype ? (SUBTYPE_LABELS[item.subtype] ?? item.subtype) : null,
        item.issuer || item.institution?.name || null,
        item.rateType ? `Indexado ao ${RATE_TYPE_LABELS[item.rateType] ?? item.rateType}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        id: item.id,
        name: item.name,
        type,
        typeLabel: INVESTMENT_TYPES.find((t) => t.type === type)?.label ?? "Outros",
        detail,
        currencyCode: item.currencyCode || "BRL",
        balanceCents: cents(item.balance) ?? 0,
        investedCents: cents(item.amountOriginal),
        profitCents: cents(item.amountProfit),
        dueDate: item.dueDate ? item.dueDate.slice(0, 10) : null,
      };
    })
    .sort((a, b) => b.balanceCents - a.balanceCents);
}

export interface PortfolioSummary {
  totalCents: number;
  profitCents: number;
  withProfit: number;
  withoutProfit: number;
  byType: { type: string; label: string; color: string; cents: number }[];
  foreign: Investment[];
}

/** Totais só em reais. Investimentos em outra moeda ficam à parte. */
export function summarizePortfolio(investments: Investment[]): PortfolioSummary {
  const brl = investments.filter((item) => item.currencyCode === "BRL");
  const known = brl.filter((item) => item.profitCents !== null);

  return {
    totalCents: brl.reduce((sum, item) => sum + item.balanceCents, 0),
    profitCents: known.reduce((sum, item) => sum + (item.profitCents ?? 0), 0),
    withProfit: known.length,
    withoutProfit: brl.length - known.length,
    byType: INVESTMENT_TYPES.map(({ type, label, color }) => ({
      type,
      label,
      color,
      cents: brl
        .filter((item) => item.type === type)
        .reduce((sum, item) => sum + item.balanceCents, 0),
    })).filter((group) => group.cents > 0),
    foreign: investments.filter((item) => item.currencyCode !== "BRL"),
  };
}
