import type { Member, MemberRole, MemberStatus } from "@/api/company";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "./InviteMemberDialog";

const STATUS_CONFIG: Record<
  MemberStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  ACTIVE: { label: "Ativo", variant: "default" },
  PENDING: { label: "Convite pendente", variant: "secondary" },
  REVOKED: { label: "Revogado", variant: "outline" },
};

const ROLE_VARIANT: Record<
  MemberRole,
  "default" | "secondary" | "outline"
> = {
  ADMIN: "default",
  OPERATOR: "secondary",
  VIEWER: "outline",
};

interface MemberListProps {
  members: Member[];
  currentUserId: number;
  onMembersChange: (members: Member[]) => void;
}

export function MemberList({
  members,
  currentUserId: _currentUserId,
  onMembersChange: _onMembersChange,
}: MemberListProps) {
  if (members.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum membro encontrado.
      </p>
    );
  }

  return (
    <div className="divide-y">
      {members.map((m) => {
        const displayName = m.user?.name ?? m.user?.email ?? m.invitedEmail ?? "—";
        const displayEmail = m.user?.email ?? m.invitedEmail ?? "";
        const statusCfg = STATUS_CONFIG[m.status];

        return (
          <div key={m.id} className="flex items-center justify-between py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              {displayEmail && displayName !== displayEmail && (
                <p className="truncate text-xs text-muted-foreground">
                  {displayEmail}
                </p>
              )}
            </div>
            <div className="ml-4 flex shrink-0 items-center gap-2">
              <Badge variant={ROLE_VARIANT[m.role]}>
                {ROLE_LABELS[m.role]}
              </Badge>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
