import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, ImageUp, Loader2 } from "lucide-react";
import {
  getCompany,
  updateCompany,
  uploadCompanyLogo,
  listMembers,
  type Company,
  type CompanyInput,
  type Member,
} from "@/api/company";
import { me, updateMe } from "@/api/auth";
import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { InviteMemberDialog } from "@/components/members/InviteMemberDialog";
import { MemberList } from "@/components/members/MemberList";
import { TemplatesSection } from "@/components/templates/TemplatesSection";

// ─── Company form schema ────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, "Informe o nome da empresa"),
  document: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .string()
    .email("E-mail inválido")
    .optional()
    .or(z.literal("")),
  address: z.string().optional(),
  footerNote: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Personal profile form schemas ──────────────────────────────────────────

const nameSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
});

const emailSchema = z.object({
  email: z.string().email("E-mail inválido"),
  currentPassword: z.string().min(1, "Informe a senha atual"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Deve conter pelo menos uma letra maiúscula")
      .regex(/[a-z]/, "Deve conter pelo menos uma letra minúscula")
      .regex(/[0-9]/, "Deve conter pelo menos um número"),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type NameForm = z.infer<typeof nameSchema>;
type EmailForm = z.infer<typeof emailSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

const EMPTY_VALUES: FormData = {
  name: "",
  document: "",
  phone: "",
  email: "",
  address: "",
  footerNote: "",
};

function toFormValues(company: Company): FormData {
  return {
    name: company.name,
    document: company.document ?? "",
    phone: company.phone ?? "",
    email: company.email ?? "",
    address: company.address ?? "",
    footerNote: company.footerNote ?? "",
  };
}

type Tab = "perfil" | "empresa" | "modelos" | "membros";

export function ProfilePage() {
  const { user, refreshSession } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [activeTab, setActiveTab] = useState<Tab>("empresa");
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Personal profile data (fetched when the Dados Pessoais tab is opened)
  const [profileName, setProfileName] = useState<string>("");
  const [profileEmail, setProfileEmail] = useState<string>("");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  });

  const { isSubmitting } = form.formState;

  const nameForm = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: "" },
  });

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "", currentPassword: "" },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    let cancelled = false;
    getCompany()
      .then((c) => {
        if (!cancelled) {
          setCompany(c);
          form.reset(toFormValues(c));
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Falha ao carregar os dados da empresa",
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [form]);

  // Load personal profile data when the Dados Pessoais tab is first opened.
  useEffect(() => {
    if (activeTab !== "perfil") return;
    let cancelled = false;
    me()
      .then((data) => {
        if (!cancelled) {
          setProfileName(data.name ?? "");
          setProfileEmail(data.email);
          nameForm.reset({ name: data.name ?? "" });
          emailForm.reset({ email: data.email, currentPassword: "" });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Load members when the Membros tab is first opened.
  useEffect(() => {
    if (activeTab !== "membros" || !isAdmin) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      setMembersLoading(true);
      listMembers()
        .then((list) => {
          if (!cancelled) {
            setMembers(list);
            setMembersLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setMembersLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [activeTab, isAdmin]);

  async function onNameSubmit(data: NameForm) {
    try {
      const updated = await updateMe({ name: data.name });
      setProfileName(updated.name ?? "");
      nameForm.reset({ name: updated.name ?? "" });
      toast.success("Nome atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado");
    }
  }

  async function onEmailSubmit(data: EmailForm) {
    try {
      const updated = await updateMe({
        email: data.email,
        currentPassword: data.currentPassword,
      });
      setProfileEmail(updated.email);
      emailForm.reset({ email: updated.email, currentPassword: "" });
      // The email lives in the JWT, so rotate the session token to keep the
      // decoded AuthContext (and anything reading user.email) in sync.
      await refreshSession();
      toast.success("E-mail atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado");
    }
  }

  async function onPasswordSubmit(data: PasswordForm) {
    try {
      await updateMe({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      passwordForm.reset();
      toast.success("Senha atualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado");
    }
  }

  async function onSubmit(data: FormData) {
    const orNull = (v?: string) => (v?.trim() ? v.trim() : null);
    const payload: CompanyInput = {
      name: data.name.trim(),
      document: orNull(data.document),
      phone: orNull(data.phone),
      email: orNull(data.email),
      address: orNull(data.address),
      footerNote: orNull(data.footerNote),
    };

    try {
      const updated = await updateCompany(payload);
      setCompany(updated);
      form.reset(toFormValues(updated));
      toast.success("Dados da empresa salvos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado");
    }
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const updated = await uploadCompanyLogo(file);
      setCompany(updated);
      toast.success("Logo atualizado");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao enviar o logo",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfil"
        subtitle="Dados da empresa e gerenciamento de membros"
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {(
          [
            "perfil",
            "empresa",
            "modelos",
            ...(isAdmin ? ["membros"] : []),
          ] as Tab[]
        ).map((tab) => {
          const labels: Record<Tab, string> = {
            perfil: "Dados Pessoais",
            empresa: "Empresa",
            modelos: "Modelos",
            membros: "Membros",
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-all",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60",
              ].join(" ")}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ─── Dados Pessoais tab ──────────────────────────────────────────── */}
      {activeTab === "perfil" && (
        <div className="space-y-4">
          {/* Name */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Nome</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Nome atual:{" "}
                <span className="font-medium text-foreground">
                  {profileName || "—"}
                </span>
              </p>
              <Form {...nameForm}>
                <form
                  onSubmit={nameForm.handleSubmit(onNameSubmit)}
                  className="flex gap-3"
                >
                  <FormField
                    control={nameForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="Novo nome" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={nameForm.formState.isSubmitting}
                  >
                    {nameForm.formState.isSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Salvar
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Email */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">E-mail</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                E-mail atual:{" "}
                <span className="font-medium text-foreground">
                  {profileEmail || "—"}
                </span>
              </p>
              <Form {...emailForm}>
                <form
                  onSubmit={emailForm.handleSubmit(onEmailSubmit)}
                  className="space-y-3"
                >
                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Novo e-mail</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="novo@email.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={emailForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha atual</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      disabled={emailForm.formState.isSubmitting}
                    >
                      {emailForm.formState.isSubmitting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Atualizar e-mail
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Password */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Alterar senha</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                  className="space-y-3"
                >
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha atual</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nova senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar nova senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      disabled={passwordForm.formState.isSubmitting}
                    >
                      {passwordForm.formState.isSubmitting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Alterar senha
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Empresa tab ─────────────────────────────────────────────────── */}
      {activeTab === "empresa" && (
        <>
          {/* Logo */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Logo</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-20 w-20 rounded-md" />
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {company?.logoUrl ? (
                      <img
                        src={company.logoUrl}
                        alt="Logo da empresa"
                        className="size-full object-contain"
                      />
                    ) : (
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={onLogoChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImageUp className="h-4 w-4" />
                      )}
                      {uploading ? "Enviando…" : "Enviar logo"}
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PNG ou JPG, até 2 MB.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Company data */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Dados da empresa</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da empresa</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex.: Despachante Silva"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="document"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CNPJ / CPF do responsável</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="00.000.000/0000-00"
                                {...field}
                              />
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
                              <Input placeholder="(00) 0000-0000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
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
                            <Input
                              placeholder="Rua, número, bairro, cidade"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="footerNote"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Observação do rodapé (opcional)
                          </FormLabel>
                          <FormControl>
                            <textarea
                              {...field}
                              rows={3}
                              placeholder="Ex.: Garantia de 90 dias para todos os serviços."
                              className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end pt-2">
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {isSubmitting ? "Salvando…" : "Salvar alterações"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Modelos tab ─────────────────────────────────────────────────── */}
      {activeTab === "modelos" && <TemplatesSection />}

      {/* ─── Membros tab ─────────────────────────────────────────────────── */}
      {activeTab === "membros" && isAdmin && (
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Membros</CardTitle>
            <InviteMemberDialog
              onInvited={(member) => setMembers((prev) => [...prev, member])}
            />
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <MemberList
                members={members}
                currentUserId={user?.id ?? 0}
                onMembersChange={setMembers}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
