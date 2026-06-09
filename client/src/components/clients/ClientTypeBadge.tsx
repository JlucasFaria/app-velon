import type { ClientType } from "@/api/clients";
import { Badge } from "@/components/ui/badge";

const labels: Record<ClientType, string> = {
  COUNTER: "Balcão",
  PARTNER: "Parceiro",
};

export function ClientTypeBadge({ type }: { type: ClientType }) {
  return (
    <Badge variant={type === "PARTNER" ? "default" : "secondary"}>
      {labels[type]}
    </Badge>
  );
}
