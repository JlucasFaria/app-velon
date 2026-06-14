import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  createOrder,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
} from "@/api/orders";
import { createClient, type ClientInput } from "@/api/clients";
import { getTemplates, type ServiceTemplate } from "@/api/templates";
import { ClientCombobox } from "@/components/clients/ClientCombobox";
import { InlineClientForm } from "@/components/orders/InlineClientForm";
import { OrderItemsField } from "@/components/orders/OrderItemsField";
import { emptyItem, orderItemSchema } from "@/components/orders/order-item";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PAYMENT_STATUS_VALUES = [
  "UNPAID",
  "PAID_PIX",
  "PAID_CREDIT",
  "PAID_DEBIT",
  "PAID_CASH",
  "PAID_TRANSFER",
  "PAID_OTHER",
] as const satisfies readonly PaymentStatus[];

const schema = z.object({
  clientId: z
    .number({ error: "Selecione um cliente" })
    .int()
    .positive("Selecione um cliente"),
  description: z.string().min(3, "A descrição deve ter ao menos 3 caracteres"),
  items: z.array(orderItemSchema).min(1, "Adicione ao menos um item"),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES),
  paymentNote: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const honorarioItem = (): FormData["items"][number] => ({
  description: "Serviço",
  category: "",
  unitValue: "15.00",
  quantity: 1,
});

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
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [templateId, setTemplateId] = useState("none");
  const [wasOpen, setWasOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: "",
      items: [honorarioItem()],
      paymentStatus: "UNPAID",
      paymentNote: "",
    },
  });

  const { isSubmitting } = form.formState;

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedPaymentStatus = useWatch({
    control: form.control,
    name: "paymentStatus",
  });

  // Reset transient React state on each open/close transition during render
  // (guarded by wasOpen) rather than in an effect, avoiding cascading renders.
  if (open && !wasOpen) {
    setWasOpen(true);
    setInlineClient({ active: false, initialName: "" });
    setTemplateId("none");
  } else if (!open && wasOpen) {
    setWasOpen(false);
    setSelectedClientName("");
    setSelectionKey(0);
  }

  // Reset the RHF form when the dialog opens.
  useEffect(() => {
    if (open) {
      form.reset({
        clientId: undefined,
        description: "",
        items: [honorarioItem()],
        paymentStatus: "UNPAID",
        paymentNote: "",
      });
    }
  }, [open, form]);

  // Load the company's service templates when the dialog opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getTemplates()
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch(() => {
        // Templates are optional; failing to load just leaves the dropdown empty.
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Selecting a template fills the description and replaces the items table;
  // every field stays editable afterwards.
  function applyTemplate(id: string) {
    setTemplateId(id);
    if (id === "none") return;
    const template = templates.find((t) => String(t.id) === id);
    if (!template) return;

    form.setValue("description", template.defaultDescription, {
      shouldValidate: true,
    });
    replace(
      template.items.length > 0
        ? template.items.map((item) => ({
            description: item.description,
            category: item.category ?? "",
            unitValue: item.suggestedValue,
            quantity: item.quantity ?? 1,
          }))
        : [emptyItem()],
    );
  }

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
        clientId: data.clientId,
        description: data.description,
        items: data.items.map((item) => ({
          description: item.description,
          category: item.category || undefined,
          unitValue: item.unitValue.replace(",", "."),
          quantity: item.quantity,
        })),
        paymentStatus: data.paymentStatus,
        paymentNote:
          data.paymentStatus === "PAID_OTHER"
            ? data.paymentNote?.trim() || undefined
            : undefined,
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
      <DialogContent className="sm:max-w-2xl">
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
              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Modelo de serviço</Label>
                  <Select value={templateId} onValueChange={applyTemplate}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        Nenhum (preencher manualmente)
                      </SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva o serviço…"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <OrderItemsField
                control={form.control}
                fields={fields}
                onAppend={() => append(emptyItem())}
                onRemove={remove}
                rootError={form.formState.errors.items?.root?.message}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pagamento</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_STATUS_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {PAYMENT_STATUS_LABELS[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedPaymentStatus === "PAID_OTHER" && (
                  <FormField
                    control={form.control}
                    name="paymentNote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forma de pagamento</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex.: cheque, boleto…"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

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
