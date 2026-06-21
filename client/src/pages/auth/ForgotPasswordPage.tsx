import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
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

const schema = z.object({
  email: z.string().email("E-mail inválido"),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: FormData) {
    try {
      await authApi.forgotPassword(data.email);
      // Backend always returns 200 (no account enumeration); confirm either way.
      setSubmittedEmail(data.email);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao enviar o e-mail",
      );
    }
  }

  return (
    <AuthLayout
      title="Esqueceu a senha?"
      subtitle="Enviaremos um link para você criar uma nova senha."
      art={{
        headline: (
          <>
            Recupere seu acesso
            <br />
            em poucos passos.
          </>
        ),
        subtitle:
          "Informe seu e-mail e siga o link que enviarmos para redefinir sua senha com segurança.",
      }}
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
      {submittedEmail ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-[color:var(--velon-primary-text)]">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="text-[15px] text-muted-foreground">
            Se houver uma conta associada a{" "}
            <span className="font-semibold text-foreground">
              {submittedEmail}
            </span>
            , você receberá um e-mail com instruções para redefinir a senha. O
            link expira em 1 hora.
          </p>
          <Button asChild className="h-[46px] w-full text-[15.5px]">
            <Link to="/login">Voltar para o login</Link>
          </Button>
        </div>
      ) : (
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
            <Button
              type="submit"
              className="h-[46px] w-full text-[15.5px]"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Enviando…" : "Enviar link de recuperação"}
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  );
}
