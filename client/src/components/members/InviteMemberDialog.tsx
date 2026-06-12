import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Copy, UserPlus } from "lucide-react";
import { inviteMember, type Member, type MemberRole } from "@/api/company";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]),
});

type FormData = z.infer<typeof schema>;

export const ROLE_LABELS: Record<MemberRole, string> = {
  ADMIN: "Admin",
  OPERATOR: "Operador",
  VIEWER: "Leitor",
};

interface InviteMemberDialogProps {
  onInvited: (member: Member) => void;
}

export function InviteMemberDialog({ onInvited }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  // Set after a successful invite so we can show the shareable accept link.
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "OPERATOR" },
  });

  const { isSubmitting } = form.formState;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setInviteLink(null);
      form.reset();
    }
  }

  async function onSubmit(data: FormData) {
    try {
      const result = await inviteMember({
        email: data.email.trim(),
        role: data.role as MemberRole,
      });
      // Build a Member for the list (no linked account yet for a pending invite).
      onInvited({
        id: result.id,
        role: result.role,
        status: result.status,
        invitedEmail: result.invitedEmail,
        inviteExpiresAt: result.inviteExpiresAt,
        user: null,
        joinedAt: new Date().toISOString(),
      });
      toast.success(`Convite criado para ${data.email}`);
      if (result.inviteUrl) {
        setInviteLink(result.inviteUrl);
      } else {
        handleOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar convite");
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" />
          Convidar membro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Convite criado. Envie este link para a pessoa aceitar o acesso:
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button type="button" variant="outline" onClick={copyLink}>
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 pt-2"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="colaborador@empresa.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível de acesso</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o acesso" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="OPERATOR">Operador</SelectItem>
                        <SelectItem value="VIEWER">Leitor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enviando…" : "Enviar convite"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
