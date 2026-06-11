import { useState } from "react";
import { MoreHorizontal, RefreshCw, ShieldCheck, UserX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  resendInvite,
  changeMemberRole,
  revokeMember,
  removeMember,
  type Member,
  type MemberRole,
  type MemberStatus,
} from "@/api/company";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "./InviteMemberDialog";

const STATUS_CONFIG: Record<
  MemberStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  ACTIVE: { label: "Ativo", variant: "default" },
  PENDING: { label: "Convite pendente", variant: "secondary" },
  REVOKED: { label: "Revogado", variant: "outline" },
};

const ROLE_VARIANT: Record<MemberRole, "default" | "secondary" | "outline"> = {
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
  currentUserId,
  onMembersChange,
}: MemberListProps) {
  const [roleDialogMember, setRoleDialogMember] = useState<Member | null>(null);
  const [pendingRole, setPendingRole] = useState<MemberRole>("OPERATOR");
  const [savingRole, setSavingRole] = useState(false);

  function updateMember(updated: Member) {
    onMembersChange(members.map((m) => (m.id === updated.id ? updated : m)));
  }

  function dropMember(id: number) {
    onMembersChange(members.filter((m) => m.id !== id));
  }

  async function handleResend(member: Member) {
    try {
      await resendInvite(member.id);
      toast.success("Convite reenviado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reenviar convite");
    }
  }

  function openRoleDialog(member: Member) {
    setRoleDialogMember(member);
    setPendingRole(member.role);
  }

  async function handleChangeRole() {
    if (!roleDialogMember) return;
    setSavingRole(true);
    try {
      const updated = await changeMemberRole(roleDialogMember.id, pendingRole);
      updateMember(updated);
      toast.success("Função atualizada");
      setRoleDialogMember(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao alterar função");
    } finally {
      setSavingRole(false);
    }
  }

  async function handleRevoke(member: Member) {
    try {
      const updated = await revokeMember(member.id);
      updateMember(updated);
      toast.success("Acesso revogado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao revogar acesso");
    }
  }

  async function handleRemove(member: Member) {
    try {
      await removeMember(member.id);
      dropMember(member.id);
      toast.success("Membro removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover membro");
    }
  }

  if (members.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum membro encontrado.
      </p>
    );
  }

  return (
    <>
      <div className="divide-y">
        {members.map((m) => {
          const isSelf = m.user?.id === currentUserId;
          const displayName =
            m.user?.name ?? m.user?.email ?? m.invitedEmail ?? "—";
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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Ações</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {m.status === "PENDING" && (
                      <DropdownMenuItem onClick={() => handleResend(m)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reenviar convite
                      </DropdownMenuItem>
                    )}
                    {m.status === "ACTIVE" && !isSelf && (
                      <>
                        <DropdownMenuItem onClick={() => openRoleDialog(m)}>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Alterar função
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRevoke(m)}
                          className="text-destructive focus:text-destructive"
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          Revogar acesso
                        </DropdownMenuItem>
                      </>
                    )}
                    {!isSelf && (
                      <>
                        {(m.status === "ACTIVE" || m.status === "PENDING") && (
                          <DropdownMenuSeparator />
                        )}
                        <DropdownMenuItem
                          onClick={() => handleRemove(m)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      {/* Change role dialog */}
      <Dialog
        open={roleDialogMember !== null}
        onOpenChange={(open) => !open && setRoleDialogMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar função</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nível de acesso</Label>
              <Select
                value={pendingRole}
                onValueChange={(v) => setPendingRole(v as MemberRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="OPERATOR">Operador</SelectItem>
                  <SelectItem value="VIEWER">Leitor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRoleDialogMember(null)}
              >
                Cancelar
              </Button>
              <Button onClick={handleChangeRole} disabled={savingRole}>
                {savingRole ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
