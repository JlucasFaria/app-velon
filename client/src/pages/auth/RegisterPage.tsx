import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import * as authApi from "@/api/auth";
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

const schema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    email: z.string().email("E-mail inválido"),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[a-zA-Z]/, "Precisa ter ao menos uma letra")
      .regex(/[0-9]/, "Precisa ter ao menos um número"),
    passwordConfirmation: z.string().min(1, "Confirme a senha"),
  })
  .refine((d) => d.password === d.passwordConfirmation, {
    message: "As senhas não coincidem",
    path: ["passwordConfirmation"],
  });

type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      passwordConfirmation: "",
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: FormData) {
    try {
      const { token, refreshToken } = await authApi.register(data);
      setSession(token, refreshToken);
      navigate("/onboarding", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao criar conta";
      if (message.includes("já está cadastrado")) {
        form.setError("email", { message });
      } else {
        toast.error(message);
      }
    }
  }

  return (
    <AuthLayout
      title="Crie sua conta"
      subtitle="Comece a organizar suas ordens de serviço em minutos."
      footer={
        <>
          Já tem uma conta?{" "}
          <Link
            to="/login"
            className="font-bold text-[color:var(--velon-primary-text)] underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </>
      }
    >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Seu nome"
                        autoComplete="name"
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="voce@exemplo.com"
                        autoComplete="email"
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
                          autoComplete="new-password"
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
              <FormField
                control={form.control}
                name="passwordConfirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar senha</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showConfirmation ? "text" : "password"}
                          autoComplete="new-password"
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
                          showConfirmation ? "Ocultar senha" : "Mostrar senha"
                        }
                        onClick={() => setShowConfirmation((v) => !v)}
                      >
                        {showConfirmation ? (
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
              <Button
                type="submit"
                className="h-11 w-full text-[15px]"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Criando conta…" : "Criar conta"}
              </Button>
            </form>
          </Form>
    </AuthLayout>
  );
}
