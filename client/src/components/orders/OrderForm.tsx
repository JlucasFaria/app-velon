import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createOrder } from "@/api/orders";
import { createClient, type ClientInput } from "@/api/clients";
import { ClientCombobox } from "@/components/clients/ClientCombobox";
import { InlineClientForm } from "@/components/orders/InlineClientForm";
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
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  clientId: z
    .number({ error: "Selecione um cliente" })
    .int()
    .positive("Selecione um cliente"),
  description: z
    .string()
    .min(3, "A descrição deve ter ao menos 3 caracteres"),
  value: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, "Informe um valor válido, ex.: 250,00"),
});

type FormData = z.infer<typeof schema>;

interface OrderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderForm({ open, onOpenChange }: OrderFormProps) {
  const navigate = useNavigate();
  const [inlineClient, setInlineClient] = useState<{
    active: boolean;
    initialName: string;
  }>({ active: false, initialName: "" });
  const [selectionKey, setSelectionKey] = useState(0);
  const [selectedClientName, setSelectedClientName] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { description: "", value: "" },
  });

  const { isSubmitting } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset({ clientId: undefined, description: "", value: "" });
      setInlineClient({ active: false, initialName: "" });
    } else {
      setSelectedClientName("");
      setSelectionKey(0);
    }
  }, [open, form]);

  function openInlineClient(query: string) {
    setInlineClient({ active: true, initialName: query });
  }

  function cancelInlineClient() {
    setInlineClient({ active: false, initialName: "" });
  }

  async function handleClientSave(data: ClientInput) {
    const client = await createClient(data);
    form.setValue("clientId", client.id);
    setSelectedClientName(client.name);
    setSelectionKey((k) => k + 1);
    cancelInlineClient();
    toast.success("Cliente criado e selecionado");
  }

  async function onSubmit(data: FormData) {
    try {
      const order = await createOrder({
        ...data,
        value: data.value.replace(",", "."),
      });
      toast.success("Ordem criada com sucesso");
      onOpenChange(false);
      navigate(`/orders/${order.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova ordem de serviço</DialogTitle>
          <DialogDescription>
            {inlineClient.active
              ? "Preencha os dados do novo cliente."
              : "Selecione o cliente e descreva o serviço a ser realizado."}
          </DialogDescription>
        </DialogHeader>

        {inlineClient.active ? (
          <InlineClientForm
            initialName={inlineClient.initialName}
            onCancel={cancelInlineClient}
            onSave={handleClientSave}
          />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <FormControl>
                      <ClientCombobox
                        key={selectionKey}
                        value={field.value ?? null}
                        onChange={(id) => field.onChange(id ?? undefined)}
                        onCreateNew={openInlineClient}
                        initialQuery={selectedClientName}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva o serviço…"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="250,00"
                        inputMode="decimal"
                        {...field}
                      />
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
                  {isSubmitting ? "Criando…" : "Criar ordem"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
