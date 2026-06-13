import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
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
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: FormData) {
    try {
      await login(data.email, data.password);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-elevated">
            V
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-primary">Velon</h1>
            <p className="text-sm text-muted-foreground">Acesse o painel de gestão</p>
          </div>
        </div>
      <Card className="w-full shadow-elevated">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Entrar na conta</CardTitle>
          <CardDescription className="text-sm">Informe suas credenciais abaixo</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="voce@exemplo.com"
                        autoComplete="email"
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          className="pr-10"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1/2 right-1 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={
                          showPassword ? "Ocultar senha" : "Mostrar senha"
                        }
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Entrando…" : "Entrar"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Não tem uma conta?{" "}
                <Link
                  to="/register"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Criar conta
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
