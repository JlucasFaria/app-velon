import type { ClientType } from "@/api/clients";
import { cn } from "@/lib/utils";

const labels: Record<ClientType, string> = {
  COUNTER: "Balcão",
  PARTNER: "Parceiro",
};

const classes: Record<ClientType, string> = {
  PARTNER: "bg-primary/12 text-primary border border-primary/20",
  COUNTER: "bg-muted text-muted-foreground border border-border",
};

export function ClientTypeBadge({ type }: { type: ClientType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        classes[type],
      )}
    >
      {labels[type]}
    </span>
  );
}
