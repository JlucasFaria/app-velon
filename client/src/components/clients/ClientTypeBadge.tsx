import type { ClientType } from "@/api/clients";
import { Badge } from "@/components/ui/badge";

const labels: Record<ClientType, string> = {
  COUNTER: "Balcão",
  PARTNER: "Parceiro",
};

const classes: Record<ClientType, string> = {
  PARTNER: "bg-primary text-primary-foreground",
  COUNTER: "border border-border bg-secondary text-secondary-foreground",
};

export function ClientTypeBadge({ type }: { type: ClientType }) {
  return <Badge className={classes[type]}>{labels[type]}</Badge>;
}
