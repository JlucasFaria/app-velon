import type { OrderStatus } from "@/api/orders";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  AWAITING_CLIENT: "Awaiting Client",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_VARIANTS: Record<OrderStatus, BadgeVariant> = {
  PENDING: "secondary",
  IN_PROGRESS: "default",
  AWAITING_CLIENT: "outline",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

// Ordered list for status dropdowns (filters, status-change control).
export const ORDER_STATUSES = Object.keys(
  ORDER_STATUS_LABELS,
) as OrderStatus[];
