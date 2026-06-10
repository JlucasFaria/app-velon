import type { OrderStatus } from "@/api/orders";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  AWAITING_CLIENT: "Aguardando cliente",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

// Semantic chip colors per status. Solid background + paired `-foreground`
// token guarantees legible contrast in both light and dark themes.
export const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  PENDING: "border border-border bg-secondary text-secondary-foreground",
  IN_PROGRESS: "bg-info text-info-foreground",
  AWAITING_CLIENT: "bg-warning text-warning-foreground",
  COMPLETED: "bg-success text-success-foreground",
  CANCELLED: "bg-danger text-danger-foreground",
};

// Ordered list for status dropdowns (filters, status-change control).
export const ORDER_STATUSES = Object.keys(
  ORDER_STATUS_LABELS,
) as OrderStatus[];
