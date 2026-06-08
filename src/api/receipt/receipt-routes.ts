import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { authMiddleware, type AuthVariables } from "../../middlewares/auth";
import { successResponse, errorResponse } from "../../utils/response";
import { errorResponseSchema } from "../../schemas/response";
import { ReceiptService } from "./receipt-service";
import { receiptDetailResponseSchema } from "./receipt-schema";

const idParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive()
    .openapi({
      param: { name: "id", in: "path" },
      description: "Order ID",
      example: 1,
    }),
});

export function createReceiptRoutes(
  receiptService: ReceiptService = new ReceiptService(),
) {
  const receiptRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

  // ─── Route Definitions ──────────────────────────────────────────

  const generateReceiptRoute = createRoute({
    method: "post",
    path: "/{id}/receipt",
    tags: ["Receipts"],
    security: [{ bearerAuth: [] }],
    request: { params: idParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: receiptDetailResponseSchema },
        },
        description: "Receipt generated or retrieved successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Order not found",
      },
    },
  });

  const getReceiptRoute = createRoute({
    method: "get",
    path: "/{id}/receipt",
    tags: ["Receipts"],
    security: [{ bearerAuth: [] }],
    request: { params: idParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: receiptDetailResponseSchema },
        },
        description: "Receipt retrieved successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Receipt not found",
      },
    },
  });

  // ─── Middleware ─────────────────────────────────────────────────

  receiptRoutes.use("/*", authMiddleware);

  // ─── Route Handlers ─────────────────────────────────────────────

  receiptRoutes.openapi(generateReceiptRoute, async (c) => {
    const { id } = c.req.valid("param");

    if (!(await receiptService.orderExists(id))) {
      return errorResponse(c, "Order not found", 404);
    }

    const receipt = await receiptService.generate(id);
    return successResponse(c, receipt, 200, "Receipt generated successfully");
  });

  receiptRoutes.openapi(getReceiptRoute, async (c) => {
    const { id } = c.req.valid("param");

    const receipt = await receiptService.getByOrderId(id);

    if (!receipt) {
      return errorResponse(c, "Receipt not found", 404);
    }

    return successResponse(c, receipt, 200, "Receipt retrieved successfully");
  });

  return receiptRoutes;
}
