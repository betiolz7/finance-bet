export interface ExportTransaction {
  date: string;
  description: string;
  type: string;
  status: string;
  amount_cents: number;
  category: { name: string } | null;
  account: { name: string } | null;
  to_account: { name: string } | null;
  invoice: { card: { name: string } } | null;
}

const TYPE_LABEL: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
  invoice_payment: "Pagamento de fatura",
};

export const EXPORT_HEADER = [
  "Data",
  "Descrição",
  "Tipo",
  "Categoria",
  "Conta ou cartão",
  "Situação",
  "Valor (R$)",
];

export interface ExportRow {
  date: Date;
  description: string;
  type: string;
  category: string;
  source: string;
  status: string;
  /** Em reais. Despesa negativa, receita positiva, movimentos entre contas sem sinal. */
  value: number;
}

export const EXPORT_COLUMNS = [
  { width: 12 },
  { width: 36 },
  { width: 18 },
  { width: 18 },
  { width: 26 },
  { width: 11 },
  { width: 14 },
];

/** Células no formato da biblioteca write-excel-file. */
export function buildSheet(rows: ExportRow[]) {
  return [
    EXPORT_HEADER.map((value) => ({ value, fontWeight: "bold" as const })),
    ...rows.map((row) => [
      { type: Date, value: row.date, format: "dd/mm/yyyy" },
      { type: String, value: row.description },
      { type: String, value: row.type },
      { type: String, value: row.category },
      { type: String, value: row.source },
      { type: String, value: row.status },
      { type: Number, value: row.value, format: "#,##0.00" },
    ]),
  ];
}

/** Linhas da planilha exportada, na mesma ordem da tela. */
export function buildExportRows(transactions: ExportTransaction[]): ExportRow[] {
  return transactions.map((t) => {
    const [year, month, day] = t.date.split("-").map(Number);
    const source = t.to_account
      ? `${t.account?.name ?? ""} → ${t.to_account.name}`
      : (t.account?.name ?? t.invoice?.card.name ?? "");
    const sign = t.type === "expense" ? -1 : 1;
    return {
      date: new Date(Date.UTC(year, month - 1, day)),
      description: t.description,
      type: TYPE_LABEL[t.type] ?? t.type,
      category: t.category?.name ?? "",
      source,
      status: t.status === "pending" ? "Pendente" : "Pago",
      value: (sign * t.amount_cents) / 100,
    };
  });
}
