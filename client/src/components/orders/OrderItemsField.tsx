import { useWatch, type Control } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { computeSubtotal, formatAmount } from "@/lib/money";
import type { OrderItemFormValue } from "@/components/orders/order-item";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// The field only ever operates on the `items` array, so internally it works
// against this minimal shape; the generic prop lets callers pass any form whose
// values include `items` without a cast at the call site.
type ItemsForm = { items: OrderItemFormValue[] };

// Presentational editor for an order's `items` field array. The parent owns the
// `useFieldArray` (so it can also `replace` items, e.g. when applying a
// template) and passes the row handles down; this component renders the table,
// the per-row inputs, the live total, and the add/remove controls.
interface OrderItemsFieldProps<T extends ItemsForm> {
  control: Control<T>;
  fields: { id: string }[];
  onAppend: () => void;
  onRemove: (index: number) => void;
  rootError?: string;
}

export function OrderItemsField<T extends ItemsForm>({
  control,
  fields,
  onAppend,
  onRemove,
  rootError,
}: OrderItemsFieldProps<T>) {
  // RHF's Control is invariant, so a Control<T> can't be used directly with the
  // concrete `items` paths. Narrow it once here; T is constrained to carry the
  // same `items` shape, so the cast is sound.
  const itemsControl = control as unknown as Control<ItemsForm>;
  const watchedItems = useWatch({ control: itemsControl, name: "items" }) ?? [];

  const total = watchedItems.reduce(
    (acc, item) => acc + computeSubtotal(item.unitValue, item.quantity),
    0,
  );

  return (
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
                      control={itemsControl}
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
                      control={itemsControl}
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
                      control={itemsControl}
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
                      control={itemsControl}
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
                      onClick={() => onRemove(index)}
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
          onClick={onAppend}
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

      {rootError && <p className="text-sm text-destructive">{rootError}</p>}
    </div>
  );
}
