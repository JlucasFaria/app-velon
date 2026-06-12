import type { MemberRole } from "@/api/company";

export const ROLE_LABELS: Record<MemberRole, string> = {
  ADMIN: "Admin",
  OPERATOR: "Operador",
  VIEWER: "Leitor",
};
