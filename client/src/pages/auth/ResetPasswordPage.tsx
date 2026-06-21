import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { ApiError } from "@/api/client";
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

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", passwordConfirmation: "" },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: FormData) {
    if (!token) return;
    try {
      await authApi.resetPassword(token, data.password);
      toast.success("Senha redefinida com sucesso. Faça login novamente.");
      navigate("/login", { replace: true });
    } catch (err) {
      // A 400 here means the token is invalid, expired or already used —
      // guide the user back to request a fresh link.
      const message =
        err instanceof ApiError && err.status === 400
          ? "Link inválido ou expirado. Solicite um novo."
          : err instanceof Error
            ? err.message
            : "Falha ao redefinir a senha";
      toast.error(message);
    }
  }

  const art = {
    headline: (
      <>
        Quase lá:
        <br />
        defina sua nova senha.
      </>
    ),
    subtitle:
      "Escolha uma senha forte para manter o acesso ao seu negócio protegido.",
  };

  // No token in the URL — nothing to reset. Point the user to the request flow.
  if (!token) {
    return (
      <AuthLayout
        title="Link inválido"
        subtitle="Este link de redefinição não é válido."
        art={art}
        footer={
          <>
            Lembrou a senha?{" "}
            <Link
              to="/login"
              className="font-bold text-[color:var(--velon-primary-text)] underline-offset-4 hover:underline"
            >
              Voltar para o login
            </Link>
          </>
        }
      >
        <div className="space-y-4 text-center">
          <p className="text-[15px] text-muted-foreground">
            O link de redefinição está incompleto ou expirou. Solicite um novo
            para continuar.
          </p>
          <Button asChild className="h-[46px] w-full text-[15.5px]">
            <Link to="/forgot-password">Solicitar novo link</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Redefinir senha"
      subtitle="Crie uma nova senha para sua conta."
      art={art}
      footer={
        <>
          Lembrou a senha?{" "}
          <Link
            to="/login"
            className="font-bold text-[color:var(--velon-primary-text)] underline-offset-4 hover:underline"
          >
            Voltar para o login
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova senha</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Mínimo 8 caracteres"
                      className="pr-10"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-1 size-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
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
                <FormLabel>Confirmar nova senha</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showConfirmation ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Repita a senha"
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
            className="h-[46px] w-full text-[15.5px]"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Redefinindo…" : "Redefinir senha"}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
