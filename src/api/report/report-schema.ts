import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";

const billingOrderSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  orderNumber: z.string().openapi({ example: "OS-0001" }),
  description: z.string().openapi({ example: "Screen replacement" }),
  value: z.string().openapi({ example: "250.00" }),
  completedAt: z
    .string()
    .datetime()
    .openapi({ description: "Date the order was last updated to COMPLETED" }),
  client: z.object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "João Silva" }),
  }),
});

export const monthlyBillingResponseSchema = successResponseSchema(
  z
    .object({
      month: z.number().int().openapi({ example: 6 }),
      year: z.number().int().openapi({ example: 2026 }),
      totalRevenue: z.string().openapi({ example: "1500.00" }),
      orderCount: z.number().int().openapi({ example: 6 }),
      orders: billingOrderSchema.array(),
    })
    .openapi("MonthlyBilling"),
  "MonthlyBillingResponse",
);

export const ordersSummaryResponseSchema = successResponseSchema(
  z
    .object({
      PENDING: z.number().int().openapi({ example: 5 }),
      IN_PROGRESS: z.number().int().openapi({ example: 3 }),
      AWAITING_CLIENT: z.number().int().openapi({ example: 2 }),
      COMPLETED: z.number().int().openapi({ example: 10 }),
      CANCELLED: z.number().int().openapi({ example: 1 }),
    })
    .openapi("OrdersSummary"),
  "OrdersSummaryResponse",
);

export const billingQuerySchema = z.object({
  month: z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .openapi({ description: "Month (1–12)", example: 6 }),
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .openapi({ description: "Full year", example: 2026 }),
});

export type BillingQuery = z.infer<typeof billingQuerySchema>;
