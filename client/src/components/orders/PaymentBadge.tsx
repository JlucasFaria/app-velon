import {
  PAYMENT_STATUS_LABELS,
  isPaid,
  type PaymentStatus,
} from "@/api/orders";
import { Badge } from "@/components/ui/badge";

interface PaymentBadgeProps {
  status: PaymentStatus;
  // For PAID_OTHER, the free-text note is shown instead of the generic label.
  note?: string | null;
}

export function PaymentBadge({ status, note }: PaymentBadgeProps) {
  const label =
    status === "PAID_OTHER" && note?.trim()
      ? note.trim()
      : PAYMENT_STATUS_LABELS[status];

  return (
    <Badge
      className={
        isPaid(status)
          ? "bg-success text-success-foreground"
          : "border border-border bg-secondary text-secondary-foreground"
      }
    >
      {label}
    </Badge>
  );
}
