import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  AWAITING_CLIENT: "Awaiting Client",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  PENDING: "secondary",
  IN_PROGRESS: "default",
  AWAITING_CLIENT: "outline",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "secondary"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
