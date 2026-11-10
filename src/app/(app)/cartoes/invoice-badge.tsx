import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/cards";

const STYLE: Record<InvoiceStatus, string> = {
  paid: "bg-brand-soft text-income",
  closed: "bg-pending-soft text-pending",
  open: "bg-canvas text-ink",
};

export function InvoiceBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}
