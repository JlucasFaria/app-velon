import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateOrder, type Order, type OrderDetail } from "@/api/orders";
import { OrderItemsField } from "@/components/orders/OrderItemsField";
import { emptyItem, orderItemSchema } from "@/components/orders/order-item";
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
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  description: z.string().min(3, "A descrição deve ter ao menos 3 caracteres"),
  items: z.array(orderItemSchema).min(1, "Adicione ao menos um item"),
});

type FormData = z.infer<typeof schema>;

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

  // Re-seed the form with the order's current values each time the dialog opens,
  // so reopening after a cancelled edit shows the persisted state, not a stale draft.
  useEffect(() => {
    if (open) form.reset(orderToFormValues(order));
  }, [open, order, form]);

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

            <OrderItemsField
              control={form.control}
              fields={fields}
              onAppend={() => append(emptyItem())}
              onRemove={remove}
              rootError={form.formState.errors.items?.root?.message}
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
                {isSubmitting ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
