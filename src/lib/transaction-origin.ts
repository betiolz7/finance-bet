export type Origin = "bank" | "sheet" | "fixed" | "manual";

export const ORIGIN_LABEL: Record<Origin, string> = {
  bank: "Banco",
  sheet: "Planilha",
  fixed: "Fixo",
  manual: "Manual",
};

/**
 * De onde veio o lançamento. Confirmado pelo banco vence os outros: um custo
 * fixo que deu baixa com a transação do banco conta como "Banco".
 */
export function originOf(row: {
  bank?: { id: string }[] | null;
  import_id?: string | null;
  recurring_rule_id?: string | null;
}): Origin {
  if (row.bank && row.bank.length > 0) return "bank";
  if (row.import_id) return "sheet";
  if (row.recurring_rule_id) return "fixed";
  return "manual";
}

export type OriginFilter = "todos" | "banco" | "meus";

export function matchesOrigin(origin: Origin, filter: OriginFilter): boolean {
  if (filter === "banco") return origin === "bank";
  if (filter === "meus") return origin !== "bank";
  return true;
}
