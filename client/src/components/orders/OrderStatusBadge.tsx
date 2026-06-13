import type { OrderStatus } from "@/api/orders";
import {
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_DOT_CLASSES,
  ORDER_STATUS_LABELS,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status }: { status: string }) {
  const key = status as OrderStatus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        ORDER_STATUS_BADGE_CLASSES[key],
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          ORDER_STATUS_DOT_CLASSES[key],
        )}
      />
      {ORDER_STATUS_LABELS[key] ?? status}
    </span>
  );
}
