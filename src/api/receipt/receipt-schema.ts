import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";
import { orderItemResponseSchema } from "../order/order-schema";

export const receiptResponseSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    receiptNumber: z.number().openapi({ example: 1 }),
    issuedAt: z
      .string()
      .datetime()
      .openapi({ description: "Date the receipt was issued" }),
    order: z
      .object({
        id: z.number().openapi({ example: 1 }),
        orderNumber: z.string().openapi({ example: "OS-0001" }),
        description: z.string().openapi({ example: "Screen replacement" }),
        value: z.string().openapi({ example: "250.00" }),
        items: orderItemResponseSchema.array(),
        client: z
          .object({
            id: z.number().openapi({ example: 1 }),
            name: z.string().openapi({ example: "João Silva" }),
            document: z.string().openapi({ example: "123.456.789-00" }),
          })
          .openapi({ description: "Client linked to the order" }),
      })
      .openapi({ description: "Service order linked to this receipt" }),
  })
  .openapi("Receipt");

export const receiptDetailResponseSchema = successResponseSchema(
  receiptResponseSchema,
  "ReceiptResponse",
);

export type ReceiptResponse = z.infer<typeof receiptResponseSchema>;
