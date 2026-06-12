import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { ClientInput } from "@/api/clients";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
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

const schema = z
  .object({
    name: z.string().min(1, "Informe o nome"),
    document: z.string().min(1, "Informe o documento"),
    phone: z.string().optional(),
    address: z.string().optional(),
    clientType: z.enum(["COUNTER", "PARTNER"]),
    partnerName: z.string().optional(),
  })
  .refine((d) => d.clientType !== "PARTNER" || !!d.partnerName?.trim(), {
    message: "Informe o nome do parceiro",
    path: ["partnerName"],
  });

type FormData = z.infer<typeof schema>;

interface InlineClientFormProps {
  initialName: string;
  onCancel: () => void;
  /** Called with validated data; caller is responsible for the API call. */
  onSave: (data: ClientInput) => Promise<void>;
}

export function InlineClientForm({
  initialName,
  onCancel,
  onSave,
}: InlineClientFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialName,
      document: "",
      phone: "",
      address: "",
      clientType: "COUNTER",
      partnerName: "",
    },
  });

  const { isSubmitting } = form.formState;
  const clientType = useWatch({ control: form.control, name: "clientType" });

  async function onSubmit(data: FormData) {
    try {
      await onSave({
        name: data.name,
        document: data.document,
        phone: data.phone || undefined,
        address: data.address || undefined,
        clientType: data.clientType,
        partnerName:
          data.clientType === "PARTNER" ? data.partnerName || undefined : undefined,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        form.setError("document", { message: err.message });
      } else {
        toast.error(err instanceof Error ? err.message : "Erro ao criar cliente");
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
          className="-ml-2 h-8 px-2 text-muted-foreground"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Voltar
        </Button>
        <span className="text-sm font-medium">Novo cliente</span>
      </div>

      <div className="rounded-md border bg-muted/30 p-3">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nome do cliente"
                      className="h-8 text-sm"
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
                  <FormLabel className="text-xs">Documento (CPF / CNPJ)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="000.000.000-00"
                      className="h-8 text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Telefone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(00) 00000-0000"
                        className="h-8 text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Tipo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-8 w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="COUNTER">Balcão</SelectItem>
                        <SelectItem value="PARTNER">Parceiro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {clientType === "PARTNER" && (
              <FormField
                control={form.control}
                name="partnerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Nome do parceiro</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nome do parceiro"
                        className="h-8 text-sm"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Endereço</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Rua, número, cidade…"
                      className="h-8 text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                {isSubmitting ? "Criando…" : "Criar cliente"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
