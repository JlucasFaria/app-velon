// Shared pt-BR display labels for Prisma enums, used by server-side renderers
// (CSV/PDF export, order PDF). Kept here so the full labels live in one place.
// Context-specific variants (e.g. the abbreviated columns in the all-orders
// report PDF) stay local to their renderer.

import type {
  OrderStatus,
  PaymentStatus,
  ClientType,
} from "../../generated/prisma";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  AWAITING_CLIENT: "Aguardando cliente",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Não pago",
  PAID_PIX: "Pago — Pix",
  PAID_CREDIT: "Pago — Cartão de crédito",
  PAID_DEBIT: "Pago — Cartão de débito",
  PAID_CASH: "Pago — Dinheiro",
  PAID_TRANSFER: "Pago — Transferência",
  PAID_OTHER: "Pago — Outro",
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  COUNTER: "Balcão",
  PARTNER: "Parceiro",
};
