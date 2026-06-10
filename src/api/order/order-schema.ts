import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";
import { paginationMetaSchema } from "../../schemas/pagination";

export const orderStatusSchema = z
  .enum(["PENDING", "IN_PROGRESS", "AWAITING_CLIENT", "COMPLETED", "CANCELLED"])
  .openapi({ description: "Service order status", example: "PENDING" });

const clientTypeSchema = z.enum(["COUNTER", "PARTNER"]).openapi({
  description: "Client type",
  example: "COUNTER",
});

const orderClientSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  name: z.string().openapi({ example: "João Silva" }),
  document: z.string().openapi({ example: "123.456.789-00" }),
  clientType: clientTypeSchema,
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

export const orderResponseSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    orderNumber: z.string().openapi({ example: "OS-0001" }),
    description: z.string().openapi({ example: "Screen replacement" }),
    value: z.string().openapi({ example: "250.00" }),
    status: orderStatusSchema,
    assignedUserId: z.number().nullable().openapi({ example: 1 }),
    clientId: z.number().openapi({ example: 1 }),
    createdAt: z.string().datetime().openapi({ description: "Creation date" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ description: "Last update date" }),
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
    value: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .openapi({
        description: "Order value (decimal as string)",
        example: "250.00",
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
    value: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional()
      .openapi({
        description: "Order value (decimal as string)",
        example: "250.00",
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
export type ChangeOrderStatusInput = z.infer<typeof changeOrderStatusSchema>;
