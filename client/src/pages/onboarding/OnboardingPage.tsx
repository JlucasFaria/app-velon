import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import * as companyApi from "@/api/company";
import { ApiError } from "@/api/client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  document: z.string().optional(),
  phone: z.string().optional(),
  // Optional, but must be a valid email when provided (empty string = not set).
  email: z.string().email("E-mail inválido").or(z.literal("")),
  address: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function nullIfEmpty(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

export function OnboardingPage() {
  const { refreshSession } = useAuth();
  const navigate = useNavigate();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", document: "", phone: "", email: "", address: "" },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: FormData) {
    try {
      await companyApi.setupCompany({
        name: data.name,
        document: nullIfEmpty(data.document),
        phone: nullIfEmpty(data.phone),
        email: nullIfEmpty(data.email),
        address: nullIfEmpty(data.address),
      });
    } catch (err) {
      // 409 means the company already exists for this user — likely a prior
      // attempt that created it but failed to refresh the token. Treat it as
      // done and fall through to refresh + navigate instead of erroring out.
      if (!(err instanceof ApiError && err.status === 409)) {
        toast.error(
          err instanceof Error ? err.message : "Falha ao configurar empresa",
        );
        return;
      }
    }

    try {
      // The setup token still carries companyId: null — refresh to get a token
      // scoped to the new company before entering the dashboard.
      await refreshSession();
    } catch {
      toast.error(
        "Empresa criada, mas não foi possível atualizar a sessão. Faça login novamente.",
      );
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-elevated">
            V
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-primary">Velon</h1>
            <p className="text-sm text-muted-foreground">Configure sua empresa para começar</p>
          </div>
        </div>
      <Card className="w-full shadow-elevated">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Dados da empresa</CardTitle>
          <CardDescription className="text-sm">
            Informe os dados do seu negócio. Você pode atualizar depois no perfil.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Nome da empresa <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Oficina do João"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF / CNPJ</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 00000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail comercial</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="contato@empresa.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua, número, cidade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Salvando…" : "Começar"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
