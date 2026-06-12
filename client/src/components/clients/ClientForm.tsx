import { useCallback, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  createClient,
  updateClient,
  getPartnerNameSuggestions,
  type Client,
} from "@/api/clients";
import { ApiError } from "@/api/client";
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
    partnerName: z.string().optional(),
  })
  .refine((d) => d.clientType !== "PARTNER" || !!d.partnerName, {
    message: "Informe o nome do parceiro",
    path: ["partnerName"],
  });

type FormData = z.infer<typeof schema>;

const EMPTY_VALUES: FormData = {
  name: "",
  document: "",
  phone: "",
  address: "",
  clientType: "COUNTER",
  partnerName: "",
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const names = await getPartnerNameSuggestions(q);
      setSuggestions(names);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setSuggestions([]);
      setShowSuggestions(false);
      form.reset(
        client
          ? {
              name: client.name,
              document: client.document,
              phone: client.phone ?? "",
              address: client.address ?? "",
              clientType: client.clientType,
              partnerName: client.partnerName ?? "",
            }
          : EMPTY_VALUES,
      );
    }, 0);
    return () => clearTimeout(t);
  }, [open, client, form]);

  async function onSubmit(data: FormData) {
    try {
      const input = {
        ...data,
        phone: data.phone || undefined,
        address: data.address || undefined,
        partnerName:
          data.clientType === "PARTNER"
            ? data.partnerName || undefined
            : undefined,
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
                name="partnerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do parceiro</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="Nome do parceiro"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            field.onChange(e);
                            void fetchSuggestions(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => {
                            if (field.value) {
                              void fetchSuggestions(field.value);
                              setShowSuggestions(true);
                            }
                          }}
                          onBlur={() => {
                            field.onBlur();
                            setTimeout(() => setShowSuggestions(false), 150);
                          }}
                        />
                        {showSuggestions && suggestions.length > 0 && (
                          <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                            {suggestions.map((name) => (
                              <li
                                key={name}
                                className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                onMouseDown={() => {
                                  field.onChange(name);
                                  setSuggestions([]);
                                  setShowSuggestions(false);
                                }}
                              >
                                {name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
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
