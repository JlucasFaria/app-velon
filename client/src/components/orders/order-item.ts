import { z } from "zod";

// Keep in sync with the backend ORDER_ITEM_QUANTITY_MAX bound.
export const QUANTITY_MAX = 100_000;

// Shared validation for a single order line item, used by both the create form
// (OrderForm) and the edit dialog (OrderEditDialog).
export const orderItemSchema = z.object({
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

export type OrderItemFormValue = z.infer<typeof orderItemSchema>;

export const emptyItem = (): OrderItemFormValue => ({
  description: "",
  category: "",
  unitValue: "",
  quantity: 1,
});
