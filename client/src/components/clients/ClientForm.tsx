import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient, updateClient, type Client } from "@/api/clients";
import { ApiError } from "@/api/client";
import { PartnerCombobox } from "@/components/clients/PartnerCombobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    partnerId: z.number().optional(),
  })
  .refine((d) => d.clientType !== "PARTNER" || d.partnerId != null, {
    message: "Selecione o parceiro",
    path: ["partnerId"],
  });

type FormData = z.infer<typeof schema>;

const EMPTY_VALUES: FormData = {
  name: "",
  document: "",
  phone: "",
  address: "",
  clientType: "COUNTER",
  partnerId: undefined,
};

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
  onSuccess: () => void;
}

export function ClientForm({
  open,
  onOpenChange,
  client,
  onSuccess,
}: ClientFormProps) {
  const isEditing = !!client;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  });

  const { isSubmitting } = form.formState;
  const clientType = useWatch({ control: form.control, name: "clientType" });

  const submitLabel = isEditing
    ? isSubmitting
      ? "Salvando…"
      : "Salvar alterações"
    : isSubmitting
      ? "Criando…"
      : "Criar cliente";

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      form.reset(
        client
          ? {
              name: client.name,
              document: client.document,
              phone: client.phone ?? "",
              address: client.address ?? "",
              clientType: client.clientType,
              partnerId: client.partner?.id,
            }
          : EMPTY_VALUES,
      );
    }, 0);
    return () => clearTimeout(t);
  }, [open, client, form]);

  async function onSubmit(data: FormData) {
    try {
      const input = {
        name: data.name,
        document: data.document,
        phone: data.phone || undefined,
        address: data.address || undefined,
        clientType: data.clientType,
        partnerId:
          data.clientType === "PARTNER" ? data.partnerId : undefined,
      };
      if (isEditing) {
        await updateClient(client.id, input);
        toast.success("Cliente atualizado com sucesso");
      } else {
        await createClient(input);
        toast.success("Cliente criado com sucesso");
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        form.setError("document", { message: err.message });
      } else {
        toast.error(err instanceof Error ? err.message : "Algo deu errado");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar cliente" : "Novo cliente"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os dados do cliente."
              : "Preencha os dados para cadastrar um novo cliente."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do cliente" {...field} />
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
                  <FormLabel>Documento (CPF / CNPJ)</FormLabel>
                  <FormControl>
                    <Input placeholder="000.000.000-00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
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
                name="clientType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
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
                name="partnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parceiro</FormLabel>
                    <FormControl>
                      <PartnerCombobox
                        value={field.value}
                        onChange={field.onChange}
                        initialLabel={client?.partner?.name}
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
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, número, cidade…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitLabel}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
