import type { MemberRole } from "@/api/company";

export const ROLE_LABELS: Record<MemberRole, string> = {
  ADMIN: "Admin",
  OPERATOR: "Operador",
  VIEWER: "Leitor",
};

export const ROLE_BADGE_CLASSES: Record<MemberRole, string> = {
  ADMIN: "bg-primary/12 text-primary border border-primary/20",
  OPERATOR: "bg-warning/15 text-warning border border-warning/30",
  VIEWER: "bg-muted text-muted-foreground border border-border",
};
