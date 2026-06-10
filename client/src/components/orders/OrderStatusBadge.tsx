import type { OrderStatus } from "@/api/orders";
import { ORDER_STATUS_LABELS, ORDER_STATUS_VARIANTS } from "@/lib/order-status";
import { Badge } from "@/components/ui/badge";

export function OrderStatusBadge({ status }: { status: string }) {
  const key = status as OrderStatus;
  return (
    <Badge variant={ORDER_STATUS_VARIANTS[key] ?? "secondary"}>
      {ORDER_STATUS_LABELS[key] ?? status}
    </Badge>
  );
}
