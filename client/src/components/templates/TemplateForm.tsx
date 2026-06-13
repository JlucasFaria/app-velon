import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  createTemplate,
  updateTemplate,
  type ServiceTemplate,
  type TemplateInput,
} from "@/api/templates";
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
  suggestedValue: z
    .string()
    // Up to 8 integer digits keeps a suggested value within Decimal(10,2).
    .regex(/^\d{1,8}([.,]\d{1,2})?$/, "Valor inválido"),
  quantity: z
    .number()
    .int("Deve ser inteiro")
    .positive("Deve ser positivo")
    .max(QUANTITY_MAX, "Muito alto")
    .optional(),
});

const schema = z.object({
  name: z.string().min(2, "Informe um nome com ao menos 2 caracteres"),
  defaultDescription: z
    .string()
    .min(3, "A descrição deve ter ao menos 3 caracteres"),
  items: z.array(itemSchema),
});

type FormData = z.infer<typeof schema>;

const emptyItem = (): FormData["items"][number] => ({
  description: "",
  category: "",
  suggestedValue: "",
  quantity: undefined,
});

function toFormValues(template: ServiceTemplate): FormData {
  return {
    name: template.name,
    defaultDescription: template.defaultDescription,
    items: template.items.map((item) => ({
      description: item.description,
      category: item.category ?? "",
      suggestedValue: item.suggestedValue,
      quantity: item.quantity ?? undefined,
    })),
  };
}

interface TemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the form edits this template; otherwise it creates a new one. */
  template?: ServiceTemplate | null;
  onSaved: (template: ServiceTemplate) => void;
}

export function TemplateForm({
  open,
  onOpenChange,
  template,
  onSaved,
}: TemplateFormProps) {
  const isEditing = !!template;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", defaultDescription: "", items: [] },
  });

  const { isSubmitting } = form.formState;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      template
        ? toFormValues(template)
        : { name: "", defaultDescription: "", items: [] },
    );
  }, [open, template, form]);

  async function onSubmit(data: FormData) {
    const payload: TemplateInput = {
      name: data.name.trim(),
      defaultDescription: data.defaultDescription.trim(),
      items: data.items.map((item) => ({
        description: item.description,
        category: item.category?.trim() || undefined,
        suggestedValue: item.suggestedValue.replace(",", "."),
        quantity: item.quantity,
      })),
    };

    try {
      const saved = template
        ? await updateTemplate(template.id, payload)
        : await createTemplate(payload);
      toast.success(isEditing ? "Modelo atualizado" : "Modelo criado");
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar modelo" : "Novo modelo de serviço"}
          </DialogTitle>
          <DialogDescription>
            Defina uma descrição e itens sugeridos para reutilizar ao criar
            ordens de serviço.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do modelo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex.: Formatação de computador"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição padrão</FormLabel>
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
              <FormLabel>Itens sugeridos</FormLabel>
              {fields.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                        <th className="px-2 py-2 font-medium">Descrição</th>
                        <th className="px-2 py-2 font-medium">Categoria</th>
                        <th className="px-2 py-2 font-medium">Vlr. Sugerido</th>
                        <th className="px-2 py-2 font-medium">Qtd</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, index) => (
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
                              name={`items.${index}.suggestedValue`}
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
                                      placeholder="—"
                                      value={f.value ?? ""}
                                      onChange={(e) =>
                                        f.onChange(
                                          e.target.value === ""
                                            ? undefined
                                            : e.target.valueAsNumber,
                                        )
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </td>
                          <td className="p-1 align-middle">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => remove(index)}
                              aria-label="Remover item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-sm"
                onClick={() => append(emptyItem())}
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar item
              </Button>
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
                {isSubmitting
                  ? "Salvando…"
                  : isEditing
                    ? "Salvar alterações"
                    : "Criar modelo"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
