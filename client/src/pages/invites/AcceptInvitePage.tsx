import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { getInviteInfo, acceptInvite, type InviteInfo } from "@/api/invites";
import { useAuth } from "@/contexts/auth-context";
import { ROLE_LABELS } from "@/components/members/member-constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const newUserSchema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[a-zA-Z]/, "Deve conter ao menos uma letra")
    .regex(/[0-9]/, "Deve conter ao menos um número"),
});

const existingUserSchema = z.object({
  name: z.string().optional(),
  password: z.string().min(1, "Informe sua senha"),
});

type FormData = { name?: string; password: string };

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "expired" | "error">(
    !token ? "error" : "loading",
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getInviteInfo(token)
      .then((data) => {
        if (!cancelled) {
          setInfo(data);
          setStatus("ready");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const status =
            err instanceof Error && "status" in err
              ? (err as { status: number }).status
              : 0;
          setStatus(status === 410 ? "expired" : "error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const schema = info?.userExists ? existingUserSchema : newUserSchema;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", password: "" },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: FormData) {
    if (!token) return;
    try {
      const { token: accessToken, refreshToken } = await acceptInvite(token, {
        name: data.name?.trim() || undefined,
        password: data.password,
      });
      setSession(accessToken, refreshToken);
      navigate("/", { replace: true });
    } catch (err) {
      form.setError("password", {
        message:
          err instanceof Error ? err.message : "Falha ao aceitar convite",
      });
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Convite expirado</CardTitle>
            <CardDescription>
              Este link de convite não é mais válido. Peça ao administrador para
              reenviar o convite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/login")}>
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error" || !info) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Convite inválido</CardTitle>
            <CardDescription>
              Este link de convite não foi encontrado ou já foi utilizado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/login")}>
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Você foi convidado</CardTitle>
          <CardDescription>
            Você recebeu um convite para ingressar em{" "}
            <span className="font-medium text-foreground">{info.companyName}</span>{" "}
            como <span className="font-medium text-foreground">{ROLE_LABELS[info.role]}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!info.userExists && (
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seu nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  Conta: <span className="font-medium text-foreground">{info.invitedEmail}</span>
                </p>
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {info.userExists ? "Sua senha" : "Crie uma senha"}
                    </FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {isSubmitting
                  ? "Entrando…"
                  : info.userExists
                    ? "Aceitar convite"
                    : "Criar conta e entrar"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
