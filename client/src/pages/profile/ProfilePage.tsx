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
  type Company,
  type CompanyInput,
} from "@/api/company";
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

export function ProfilePage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  });

  const { isSubmitting } = form.formState;

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

  async function onSubmit(data: FormData) {
    // Send only filled fields: the backend rejects empty values for validated
    // fields (e.g. document length, email format) and update is partial.
    const payload: CompanyInput = { name: data.name.trim() };
    if (data.document?.trim()) payload.document = data.document.trim();
    if (data.phone?.trim()) payload.phone = data.phone.trim();
    if (data.email?.trim()) payload.email = data.email.trim();
    if (data.address?.trim()) payload.address = data.address.trim();
    if (data.footerNote?.trim()) payload.footerNote = data.footerNote.trim();

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Dados da empresa usados no cabeçalho da OS e nos documentos
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

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
                        <Input placeholder="Ex.: Despachante Silva" {...field} />
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
                          <Input placeholder="00.000.000/0000-00" {...field} />
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
                      <FormLabel>Observação do rodapé (opcional)</FormLabel>
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
    </div>
  );
}
