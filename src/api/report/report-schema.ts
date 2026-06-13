import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";

const ORDER_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "AWAITING_CLIENT",
  "COMPLETED",
  "CANCELLED",
] as const;

const PAYMENT_STATUSES = [
  "UNPAID",
  "PAID_PIX",
  "PAID_CREDIT",
  "PAID_DEBIT",
  "PAID_CASH",
  "PAID_TRANSFER",
  "PAID_OTHER",
] as const;

const billingOrderSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  orderNumber: z.string().openapi({ example: "OS-0001" }),
  description: z.string().openapi({ example: "Screen replacement" }),
  value: z.string().openapi({ example: "250.00" }),
  honorario: z.string().openapi({
    description: "Service-fee total for this order (items in the Honorário category)",
    example: "100.00",
  }),
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
      totalHonorario: z.string().openapi({
        description: "Sum of service-fee (Honorário) items across the month",
        example: "600.00",
      }),
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

// ─── All Orders Report ────────────────────────────────────────────────────────

export const allOrdersQuerySchema = z.object({
  dateFrom: z.string().date().optional().openapi({
    description: "Filter orders created on or after this date (YYYY-MM-DD)",
    example: "2026-01-01",
  }),
  dateTo: z.string().date().optional().openapi({
    description: "Filter orders created on or before this date (YYYY-MM-DD)",
    example: "2026-12-31",
  }),
  status: z.enum(ORDER_STATUSES).optional().openapi({
    description: "Filter by OS status",
    example: "COMPLETED",
  }),
  partnerName: z.string().optional().openapi({
    description: "Filter by the client's partner name (case-insensitive)",
    example: "Parceiro XYZ",
  }),
});

export type AllOrdersQuery = z.infer<typeof allOrdersQuerySchema>;

const allOrdersRowSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  orderNumber: z.string().openapi({ example: "OS-0001" }),
  client: z.object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().openapi({ example: "João Silva" }),
  }),
  createdAt: z
    .string()
    .datetime()
    .openapi({ example: "2026-06-01T10:00:00.000Z" }),
  completedAt: z.string().datetime().nullable().openapi({
    example: "2026-06-15T14:30:00.000Z",
  }),
  total: z.string().openapi({ example: "350.00" }),
  honorario: z.string().openapi({ example: "100.00" }),
  paymentStatus: z.enum(PAYMENT_STATUSES).openapi({ example: "PAID_PIX" }),
  status: z.enum(ORDER_STATUSES).openapi({ example: "COMPLETED" }),
});

const allOrdersTotalsSchema = z.object({
  sumTotal: z.string().openapi({ example: "1500.00" }),
  sumHonorario: z.string().openapi({ example: "300.00" }),
  totalReceived: z.string().openapi({ example: "1200.00" }),
});

export const allOrdersResponseSchema = successResponseSchema(
  z
    .object({
      orders: allOrdersRowSchema.array(),
      totals: allOrdersTotalsSchema,
    })
    .openapi("AllOrders"),
  "AllOrdersResponse",
);
