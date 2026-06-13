import {
  PAYMENT_STATUS_LABELS,
  isPaid,
  type PaymentStatus,
} from "@/api/orders";
import { cn } from "@/lib/utils";

interface PaymentBadgeProps {
  status: PaymentStatus;
  note?: string | null;
}

export function PaymentBadge({ status, note }: PaymentBadgeProps) {
  const label =
    status === "PAID_OTHER" && note?.trim()
      ? note.trim()
      : PAYMENT_STATUS_LABELS[status];

  const paid = isPaid(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        paid
          ? "bg-success/12 text-success border border-success/20"
          : "bg-muted text-muted-foreground border border-border",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          paid ? "bg-success" : "bg-muted-foreground",
        )}
      />
      {label}
    </span>
  );
}
