import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  createOrder,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
} from "@/api/orders";
import { createClient, type ClientInput } from "@/api/clients";
import { getTemplates, type ServiceTemplate } from "@/api/templates";
import { ClientCombobox } from "@/components/clients/ClientCombobox";
import { InlineClientForm } from "@/components/orders/InlineClientForm";
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

// Keep in sync with the backend ORDER_ITEM_QUANTITY_MAX bound.
const QUANTITY_MAX = 100_000;

const itemSchema = z.object({
  description: z.string().min(1, "Obrigatório"),
  category: z.string().optional(),
  unitValue: z
    .string()
    // Up to 8 integer digits keeps a single unit within Decimal(10,2).
    .regex(/^\d{1,8}([.,]\d{1,2})?$/, "Valor inválido"),
  quantity: z
    .number()
    .int("Deve ser inteiro")
    .positive("Deve ser positivo")
    .max(QUANTITY_MAX, "Muito alto"),
});

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
  description: z
    .string()
    .min(3, "A descrição deve ter ao menos 3 caracteres"),
  items: z.array(itemSchema).min(1, "Adicione ao menos um item"),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES),
  paymentNote: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const emptyItem = (): FormData["items"][number] => ({
  description: "",
  category: "",
  unitValue: "",
  quantity: 1,
});

function parseAmount(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) || n < 0 ? 0 : n;
}

function computeSubtotal(unitValue: string, quantity: number): number {
  const qty = Math.max(0, Math.floor(Number(quantity)));
  return (Math.round(parseAmount(unitValue) * 100) * qty) / 100;
}

function formatAmount(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
      items: [emptyItem()],
      paymentStatus: "UNPAID",
      paymentNote: "",
    },
  });

  const { isSubmitting } = form.formState;

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = useWatch({ control: form.control, name: "items" });
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
        items: [emptyItem()],
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

  const total = watchedItems.reduce(
    (acc, item) => acc + computeSubtotal(item.unitValue, item.quantity),
    0,
  );

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

              <div className="space-y-2">
                <FormLabel>Itens</FormLabel>
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Descrição</th>
                        <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Categoria</th>
                        <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Vlr. Unit.</th>
                        <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Qtd</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Subtotal</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, index) => {
                        const subtotal = computeSubtotal(
                          watchedItems[index]?.unitValue ?? "",
                          Number(watchedItems[index]?.quantity ?? 0),
                        );
                        return (
                          <tr
                            key={field.id}
                            className="border-b last:border-0"
                          >
                            <td className="p-1 align-top">
                              <FormField
                                control={form.control}
                                name={`items.${index}.description`}
                                render={({ field: f }) => (
                                  <FormItem className="space-y-1">
                                    <FormControl>
                                      <Input
                                        className="h-8 min-w-[120px]"
                                        placeholder="Descrição"
                                        {...f}
                                      />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="p-1 align-top">
                              <FormField
                                control={form.control}
                                name={`items.${index}.category`}
                                render={({ field: f }) => (
                                  <FormItem className="space-y-0">
                                    <FormControl>
                                      <Input
                                        className="h-8 w-24"
                                        placeholder="Opcional"
                                        {...f}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="p-1 align-top">
                              <FormField
                                control={form.control}
                                name={`items.${index}.unitValue`}
                                render={({ field: f }) => (
                                  <FormItem className="space-y-1">
                                    <FormControl>
                                      <Input
                                        className="h-8 w-24"
                                        placeholder="0,00"
                                        inputMode="decimal"
                                        {...f}
                                      />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="p-1 align-top">
                              <FormField
                                control={form.control}
                                name={`items.${index}.quantity`}
                                render={({ field: f }) => (
                                  <FormItem className="space-y-1">
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min={1}
                                        className="h-8 w-16"
                                        {...f}
                                        onChange={(e) =>
                                          f.onChange(
                                            e.target.valueAsNumber || 1,
                                          )
                                        }
                                      />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="p-1 text-right align-middle text-muted-foreground">
                              {subtotal > 0 ? formatAmount(subtotal) : "—"}
                            </td>
                            <td className="p-1 align-middle">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                disabled={fields.length === 1}
                                onClick={() => remove(index)}
                                aria-label="Remover item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => append(emptyItem())}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar item
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Total:{" "}
                    <span className="font-semibold text-foreground">
                      R$ {formatAmount(total)}
                    </span>
                  </p>
                </div>

                {form.formState.errors.items?.root?.message && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.items.root.message}
                  </p>
                )}
              </div>

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
                          <Input placeholder="Ex.: cheque, boleto…" {...field} />
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
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
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
