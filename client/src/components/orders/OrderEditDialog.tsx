import { useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { updateOrder, type Order, type OrderDetail } from "@/api/orders";
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

const schema = z.object({
  description: z.string().min(3, "A descrição deve ter ao menos 3 caracteres"),
  items: z.array(itemSchema).min(1, "Adicione ao menos um item"),
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

// Maps a persisted order into the form's editable shape.
function orderToFormValues(order: OrderDetail): FormData {
  return {
    description: order.description,
    items: order.items.map((item) => ({
      description: item.description,
      category: item.category ?? "",
      unitValue: item.unitValue,
      quantity: item.quantity,
    })),
  };
}

interface OrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDetail;
  onUpdated: (order: Order) => void;
}

export function OrderEditDialog({
  open,
  onOpenChange,
  order,
  onUpdated,
}: OrderEditDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: orderToFormValues(order),
  });

  const { isSubmitting } = form.formState;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = useWatch({ control: form.control, name: "items" });

  // Re-seed the form with the order's current values each time the dialog opens,
  // so reopening after a cancelled edit shows the persisted state, not a stale draft.
  useEffect(() => {
    if (open) form.reset(orderToFormValues(order));
  }, [open, order, form]);

  const total = watchedItems.reduce(
    (acc, item) => acc + computeSubtotal(item.unitValue, item.quantity),
    0,
  );

  async function onSubmit(data: FormData) {
    try {
      const updated = await updateOrder(order.id, {
        description: data.description,
        items: data.items.map((item) => ({
          description: item.description,
          category: item.category || undefined,
          unitValue: item.unitValue.replace(",", "."),
          quantity: item.quantity,
        })),
      });
      toast.success("Ordem atualizada com sucesso");
      onUpdated(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar ordem de serviço</DialogTitle>
          <DialogDescription>
            Atualize a descrição e os itens da ordem {order.orderNumber}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                        Descrição
                      </th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                        Categoria
                      </th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                        Vlr. Unit.
                      </th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                        Qtd
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                        Subtotal
                      </th>
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
                        <tr key={field.id} className="border-b last:border-0">
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
                                        f.onChange(e.target.valueAsNumber || 1)
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
                {isSubmitting ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
