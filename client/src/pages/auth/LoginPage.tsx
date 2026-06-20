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
import { AuthLayout } from "@/components/auth/AuthLayout";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
  remember: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: true },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: FormData) {
    try {
      await login(data.email, data.password, data.remember);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar");
    }
  }

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Acesse o painel de gestão do seu negócio."
      art={{
        headline: (
          <>
            Ordens de serviço,
            <br />
            do balcão ao recibo.
          </>
        ),
        subtitle:
          "Organize atendimentos, acompanhe prazos e fature mais rápido — tudo num só lugar.",
      }}
      footer={
        <>
          Não tem uma conta?{" "}
          <Link
            to="/register"
            className="font-bold text-[color:var(--velon-primary-text)] underline-offset-4 hover:underline"
          >
            Criar conta
          </Link>
        </>
      }
    >
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
              <div className="flex items-center justify-between pt-1">
                <FormField
                  control={form.control}
                  name="remember"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <label className="flex cursor-pointer items-center gap-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="size-4 accent-primary"
                          />
                        </FormControl>
                        <span className="text-[13.5px] text-muted-foreground">
                          Lembrar de mim
                        </span>
                      </label>
                    </FormItem>
                  )}
                />
                <button
                  type="button"
                  onClick={() =>
                    toast.info(
                      "A recuperação de senha estará disponível em breve.",
                    )
                  }
                  className="text-[13.5px] font-semibold text-[color:var(--velon-primary-text)] hover:underline"
                >
                  Esqueci a senha
                </button>
              </div>
              <Button
                type="submit"
                className="h-[46px] w-full text-[15.5px]"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          </Form>
    </AuthLayout>
  );
}
