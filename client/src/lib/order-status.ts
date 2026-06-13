import type { OrderStatus } from "@/api/orders";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  AWAITING_CLIENT: "Aguardando cliente",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

// Soft pill styles per status — muted background tones harmonized with the
// teal+terracotta palette. Each entry is [pill classes, dot color class].
export const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  PENDING:
    "bg-muted text-muted-foreground border border-border",
  IN_PROGRESS:
    "bg-info/12 text-info border border-info/20",
  AWAITING_CLIENT:
    "bg-warning/15 text-warning-foreground border border-warning/25",
  COMPLETED:
    "bg-success/12 text-success border border-success/20",
  CANCELLED:
    "bg-danger/10 text-danger border border-danger/20",
};

export const ORDER_STATUS_DOT_CLASSES: Record<OrderStatus, string> = {
  PENDING: "bg-muted-foreground",
  IN_PROGRESS: "bg-info",
  AWAITING_CLIENT: "bg-warning",
  COMPLETED: "bg-success",
  CANCELLED: "bg-danger",
};

export const ORDER_STATUSES = Object.keys(
  ORDER_STATUS_LABELS,
) as OrderStatus[];
