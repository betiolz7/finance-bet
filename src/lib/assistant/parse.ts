import { addDays, formatMonth, monthBounds, shiftMonth } from "../dates";
import { normalizeName } from "../import";

// Entende perguntas em português por palavras-chave, sem IA. Isolado aqui para
// poder ser trocado por um modelo de linguagem depois, mantendo a mesma saída.

export type Intent =
  | "spent_on"
  | "spent_total"
  | "top_expenses"
  | "by_category"
  | "compare"
  | "recurring"
  | "balance"
  | "upcoming"
  | "budget"
  | "goals"
  | "projection"
  | "income"
  | "investments"
  | "net_worth"
  | "average"
  | "unknown";

export interface Period {
  start: string;
  /** Exclusivo. */
  end: string;
  label: string;
  /** Mês no formato YYYY-MM quando o período é um mês inteiro. */
  month?: string;
}

export interface ParsedQuestion {
  intent: Intent;
  period: Period;
  term?: string;
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function monthPeriod(month: string, label?: string): Period {
  const { start, end } = monthBounds(month);
  return { start, end, month, label: label ?? formatMonth(month) };
}

/** Acha o período citado e devolve o texto sem ele, para não atrapalhar o termo. */
export function extractPeriod(text: string, today: string): { period: Period; rest: string } {
  const current = today.slice(0, 7);

  const lastDays = text.match(/\bultimos?\s+(\d{1,3})\s+dias?\b/);
  if (lastDays) {
    const days = Math.max(1, Number(lastDays[1]));
    return {
      period: {
        start: addDays(today, -(days - 1)),
        end: addDays(today, 1),
        label: `últimos ${days} dias`,
      },
      rest: text.replace(lastDays[0], " "),
    };
  }

  const previous = text.match(/\b(mes passado|mes anterior|ultimo mes)\b/);
  if (previous) {
    return {
      period: monthPeriod(shiftMonth(current, -1), "mês passado"),
      rest: text.replace(previous[0], " "),
    };
  }

  const year = text.match(/\b(este ano|esse ano|neste ano|nesse ano|no ano|do ano)\b/);
  if (year) {
    return {
      period: {
        start: `${today.slice(0, 4)}-01-01`,
        end: addDays(today, 1),
        label: `${today.slice(0, 4)} até hoje`,
      },
      rest: text.replace(year[0], " "),
    };
  }

  const named = text.match(
    new RegExp(`\\b(?:em |no mes de |de )?(${MONTHS.join("|")})(?: de (\\d{4}))?\\b`),
  );
  if (named) {
    const monthNumber = MONTHS.indexOf(named[1]) + 1;
    let yearNumber = named[2] ? Number(named[2]) : Number(today.slice(0, 4));
    const candidate = `${yearNumber}-${String(monthNumber).padStart(2, "0")}`;
    // Sem ano, um mês que ainda não chegou é do ano passado.
    if (!named[2] && candidate > current) yearNumber -= 1;
    const month = `${yearNumber}-${String(monthNumber).padStart(2, "0")}`;
    return { period: monthPeriod(month), rest: text.replace(named[0], " ") };
  }

  const thisMonth = text.match(/\b(este mes|esse mes|neste mes|nesse mes|do mes|no mes|mes atual)\b/);
  return {
    period: monthPeriod(current, "este mês"),
    rest: thisMonth ? text.replace(thisMonth[0], " ") : text,
  };
}

const FILLER = /\b(ate agora|ate hoje|por favor|ai|ate o momento)\b/g;

export function parseQuestion(question: string, today: string): ParsedQuestion {
  const text = normalizeName(question).replace(/[?!.,;:]/g, " ").replace(/\s+/g, " ");
  const { period, rest } = extractPeriod(text, today);
  const clean = rest.replace(FILLER, " ").replace(/\s+/g, " ").trim();
  const has = (pattern: RegExp) => pattern.test(clean);

  if (has(/\b(patrimonio|quanto tenho no total|tudo que tenho)\b/)) {
    return { intent: "net_worth", period };
  }
  if (has(/\b(investimento|investimentos|investido|investida|carteira|aplicacao|aplicacoes|aplicado)\b/)) {
    return { intent: "investments", period };
  }
  if (has(/\b(media|medio|em media|por mes normalmente)\b/)) {
    return { intent: "average", period };
  }
  if (has(/\b(assinatura|assinaturas|recorrente|recorrentes|todo mes|todos os meses|custos? fixos?)\b/)) {
    return { intent: "recurring", period };
  }
  if (has(/\b(compar\w*|diferenca|em relacao)\b/)) return { intent: "compare", period };
  if (has(/\b(saldo|saldos|quanto tenho|dinheiro em conta|minhas contas)\b/)) {
    return { intent: "balance", period };
  }
  if (has(/\b(vencer|vence|vencimento|vencimentos|a pagar|contas pendentes|boletos?|faturas?)\b/)) {
    return { intent: "upcoming", period };
  }
  if (has(/\b(orcamento|orcamentos|limite de gastos)\b/)) return { intent: "budget", period };
  if (has(/\bmetas?\b/)) return { intent: "goals", period };
  if (has(/\b(previsao|vai sobrar|fim do mes|vou terminar|sobrar)\b/)) {
    return { intent: "projection", period };
  }
  if (has(/\b(maior|maiores|mais caro|mais caros|onde mais gastei|top)\b/)) {
    return { intent: "top_expenses", period };
  }
  if (has(/\b(categoria|categorias|por categoria)\b/)) return { intent: "by_category", period };
  if (has(/\b(recebi|receb\w*|entrou|entraram|entrada|entradas|receita|receitas|ganhei|salario)\b/)) {
    return { intent: "income", period };
  }

  const spentOn = clean.match(
    /\b(?:gastei|gasto|gastos|gastamos|paguei|pago|comprei|despesas?)\s+(?:com|no|na|nos|nas|em|de|do|da)\s+(.+)$/,
  );
  if (spentOn) {
    // Tira artigos do começo e preposições que sobraram do período no fim.
    const term = spentOn[1]
      .replace(/^(o|a|os|as)\s+/, "")
      .replace(/(\s+(no|nos|na|nas|em|de|do|da|dos|das|neste|nesse|este|esse))+$/, "")
      .trim();
    if (term) return { intent: "spent_on", period, term };
  }
  if (has(/\b(gastei|gasto|gastos|despesa|despesas|gastamos|paguei)\b/)) {
    return { intent: "spent_total", period };
  }

  return { intent: "unknown", period };
}

export const SUGGESTIONS = [
  "Quanto gastei este mês?",
  "Quanto gastei com iFood?",
  "Quais foram meus maiores gastos?",
  "Gastos por categoria no mês passado",
  "Comparar com o mês passado",
  "Quais assinaturas eu pago?",
  "Qual meu saldo?",
  "O que vence nos próximos dias?",
  "Como está meu orçamento?",
  "Como estão minhas metas?",
  "Quanto vai sobrar no fim do mês?",
  "Quanto recebi este ano?",
  "Quanto tenho investido?",
  "Qual meu patrimônio?",
  "Quanto gasto em média por mês?",
  "Quanto gastei no cartão este mês?",
];
