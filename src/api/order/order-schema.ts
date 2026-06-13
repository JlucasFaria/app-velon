import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";
import { paginationMetaSchema } from "../../schemas/pagination";
import { ORDER_ITEM_QUANTITY_MAX } from "../../config/constants";

export const orderStatusSchema = z
  .enum(["PENDING", "IN_PROGRESS", "AWAITING_CLIENT", "COMPLETED", "CANCELLED"])
  .openapi({ description: "Service order status", example: "PENDING" });

export const paymentStatusSchema = z
  .enum([
    "UNPAID",
    "PAID_PIX",
    "PAID_CREDIT",
    "PAID_DEBIT",
    "PAID_CASH",
    "PAID_TRANSFER",
    "PAID_OTHER",
  ])
  .openapi({ description: "Payment status", example: "UNPAID" });

const clientTypeSchema = z.enum(["COUNTER", "PARTNER"]).openapi({
  description: "Client type",
  example: "COUNTER",
});

const orderClientSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  name: z.string().openapi({ example: "João Silva" }),
  document: z.string().openapi({ example: "123.456.789-00" }),
  clientType: clientTypeSchema,
  partnerName: z.string().nullable().openapi({ example: "Parceiro XYZ" }),
});

const statusHistoryEntrySchema = z.object({
  id: z.number().openapi({ example: 1 }),
  fromStatus: orderStatusSchema.nullable(),
  toStatus: orderStatusSchema,
  changedAt: z
    .string()
    .datetime()
    .openapi({ description: "When the status changed" }),
  note: z
    .string()
    .nullable()
    .openapi({ example: "Part arrived, starting repair" }),
  changedBy: z
    .object({
      id: z.number().openapi({ example: 1 }),
      name: z.string().nullable().openapi({ example: "Alice" }),
      email: z.string().openapi({ example: "alice@template.com" }),
    })
    .openapi({ description: "User who made the change" }),
});

export const orderItemInputSchema = z
  .object({
    description: z.string().min(1, "Descrição obrigatória").openapi({
      example: "Troca de tela",
    }),
    category: z.string().optional().openapi({ example: "Honorário" }),
    unitValue: z
      .string()
      // Up to 8 integer digits keeps a single unit within Decimal(10,2).
      .regex(/^\d{1,8}(\.\d{1,2})?$/, "Valor unitário inválido")
      .openapi({
        description: "Unit price as decimal string",
        example: "250.00",
      }),
    quantity: z
      .number()
      .int("Quantidade deve ser um número inteiro")
      .positive("Quantidade deve ser positiva")
      .max(ORDER_ITEM_QUANTITY_MAX, "Quantidade muito alta")
      .openapi({ example: 1 }),
  })
  .openapi("OrderItemInput");

export const orderItemResponseSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    description: z.string().openapi({ example: "Troca de tela" }),
    category: z.string().nullable().openapi({ example: "Honorário" }),
    unitValue: z.string().openapi({ example: "250.00" }),
    quantity: z.number().openapi({ example: 1 }),
    subtotal: z.string().openapi({ example: "250.00" }),
  })
  .openapi("OrderItem");

export const orderResponseSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    orderNumber: z.string().openapi({ example: "OS-0001" }),
    description: z.string().openapi({ example: "Screen replacement" }),
    value: z.string().openapi({ example: "250.00" }),
    status: orderStatusSchema,
    paymentStatus: paymentStatusSchema,
    paymentNote: z
      .string()
      .nullable()
      .openapi({ description: "Free text for PAID_OTHER", example: "Cheque" }),
    assignedUserId: z.number().nullable().openapi({ example: 1 }),
    clientId: z.number().openapi({ example: 1 }),
    createdAt: z.string().datetime().openapi({ description: "Creation date" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ description: "Last update date" }),
    items: orderItemResponseSchema.array(),
  })
  .openapi("ServiceOrder");

export const orderDetailResponseSchema = orderResponseSchema
  .extend({
    client: orderClientSchema,
    statusHistory: statusHistoryEntrySchema.array(),
  })
  .openapi("ServiceOrderDetail");

// List rows embed only the client's id and name — enough for the orders table.
export const orderListItemSchema = orderResponseSchema
  .extend({
    client: z.object({
      id: z.number().openapi({ example: 1 }),
      name: z.string().openapi({ example: "João Silva" }),
    }),
  })
  .openapi("ServiceOrderListItem");

export const createOrderSchema = z
  .object({
    description: z.string().min(3).openapi({
      description: "Service description",
      example: "Screen replacement",
    }),
    items: orderItemInputSchema
      .array()
      .min(1, "Informe ao menos um item")
      .openapi({ description: "Order line items" }),
    paymentStatus: paymentStatusSchema.optional().openapi({
      description: "Payment status (defaults to UNPAID)",
    }),
    paymentNote: z.string().optional().openapi({
      description: "Free text describing the payment (used when PAID_OTHER)",
      example: "Cheque",
    }),
    clientId: z.number().int().positive().openapi({
      description: "Client ID",
      example: 1,
    }),
    assignedUserId: z.number().int().positive().optional().openapi({
      description: "Assigned technician user ID",
      example: 1,
    }),
  })
  .openapi("CreateOrderInput");

export const updateOrderSchema = z
  .object({
    description: z.string().min(3).optional().openapi({
      description: "Service description",
      example: "Screen replacement",
    }),
    items: orderItemInputSchema
      .array()
      .min(1, "Informe ao menos um item")
      .optional()
      .openapi({ description: "Replace all line items" }),
    paymentStatus: paymentStatusSchema.optional().openapi({
      description: "Payment status",
    }),
    paymentNote: z.string().nullable().optional().openapi({
      description: "Free text describing the payment (used when PAID_OTHER)",
      example: "Cheque",
    }),
    assignedUserId: z.number().int().positive().nullable().optional().openapi({
      description: "Assigned technician user ID (null to unassign)",
      example: 1,
    }),
  })
  .openapi("UpdateOrderInput");

export const changeOrderStatusSchema = z
  .object({
    status: orderStatusSchema,
    note: z.string().optional().openapi({
      description: "Optional note explaining the status change",
      example: "Part arrived, starting repair",
    }),
  })
  .openapi("ChangeOrderStatusInput");

export const createOrderResponseSchema = successResponseSchema(
  orderResponseSchema,
  "CreateOrderResponse",
);

export const orderDetailWithHistoryResponseSchema = successResponseSchema(
  orderDetailResponseSchema,
  "OrderDetailResponse",
);

export const paginatedOrdersResponseSchema = successResponseSchema(
  z.object({
    orders: orderListItemSchema.array(),
    pagination: paginationMetaSchema,
  }),
  "PaginatedOrdersResponse",
);

export const updateOrderResponseSchema = successResponseSchema(
  orderResponseSchema,
  "UpdateOrderResponse",
);

export const changeStatusResponseSchema = successResponseSchema(
  orderDetailResponseSchema,
  "ChangeStatusResponse",
);

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type ChangeOrderStatusInput = z.infer<typeof changeOrderStatusSchema>;
