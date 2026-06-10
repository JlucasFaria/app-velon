import type { OrderStatus } from "@/api/orders";
import {
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_LABELS,
} from "@/lib/order-status";
import { Badge } from "@/components/ui/badge";

export function OrderStatusBadge({ status }: { status: string }) {
  const key = status as OrderStatus;
  return (
    <Badge className={ORDER_STATUS_BADGE_CLASSES[key]}>
      {ORDER_STATUS_LABELS[key] ?? status}
    </Badge>
  );
}
