import type { OrderStatus, PaymentStatus } from "../../generated/prisma";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  AWAITING_CLIENT: "Aguardando cliente",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Não pago",
  PAID_PIX: "Pago — Pix",
  PAID_CREDIT: "Pago — Cartão de crédito",
  PAID_DEBIT: "Pago — Cartão de débito",
  PAID_CASH: "Pago — Dinheiro",
  PAID_TRANSFER: "Pago — Transferência",
  PAID_OTHER: "Pago — Outro",
};

export interface CsvReportRow {
  orderNumber: string;
  client: { name: string };
  createdAt: string;
  completedAt: string | null;
  total: string;
  honorario: string;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
}

export interface CsvReportTotals {
  sumTotal: string;
  sumHonorario: string;
  totalReceived: string;
}

// RFC 4180: wrap in double-quotes when the value contains comma, quote, or
// newline. Also neutralizes CSV formula injection (CWE-1236): Excel/Sheets
// execute cells starting with = + - @ (or tab/CR), so prefix those with a
// single quote before quoting.
function escapeCell(value: string): string {
  const sanitized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

function csvRow(cells: string[]): string {
  return cells.map(escapeCell).join(",");
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(iso),
  );
}

export function generateReportCsv(
  orders: CsvReportRow[],
  totals: CsvReportTotals,
): string {
  const lines: string[] = [
    csvRow([
      "Nº OS",
      "Cliente",
      "Criado em",
      "Concluído em",
      "Total",
      "Honorário",
      "Pagamento",
      "Status",
    ]),
    ...orders.map((o) =>
      csvRow([
        o.orderNumber,
        o.client.name,
        formatDate(o.createdAt),
        o.completedAt ? formatDate(o.completedAt) : "",
        o.total,
        o.honorario,
        PAYMENT_STATUS_LABELS[o.paymentStatus],
        ORDER_STATUS_LABELS[o.status],
      ]),
    ),
    "",
    csvRow([
      "Total geral",
      totals.sumTotal,
      "Total honorários",
      totals.sumHonorario,
      "Total recebido",
      totals.totalReceived,
    ]),
  ];

  return lines.join("\n");
}
