import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import {
  authMiddleware,
  getCompanyContext,
  type AuthVariables,
} from "../../middlewares/auth";
import { successResponse, errorResponse } from "../../utils/response";
import { paginationQuerySchema } from "../../schemas/pagination";
import {
  errorResponseSchema,
  validationErrorResponseSchema,
} from "../../schemas/response";
import { requireMinRole } from "../../middlewares/permissions";
import { OrderService } from "./order-service";
import {
  createOrderSchema,
  updateOrderSchema,
  changeOrderStatusSchema,
  createOrderResponseSchema,
  updateOrderResponseSchema,
  orderDetailWithHistoryResponseSchema,
  paginatedOrdersResponseSchema,
  changeStatusResponseSchema,
} from "./order-schema";

const orderQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum([
      "PENDING",
      "IN_PROGRESS",
      "AWAITING_CLIENT",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional()
    .openapi({ description: "Filter by order status", example: "PENDING" }),
  clientType: z.enum(["COUNTER", "PARTNER"]).optional().openapi({
    description: "Filter by client type",
    example: "COUNTER",
  }),
  search: z.string().optional().openapi({
    description: "Search by order number or client name",
    example: "OS-0001",
  }),
  payment: z.enum(["paid", "unpaid", "all"]).optional().openapi({
    description: "Filter by payment situation (paid = any non-UNPAID status)",
    example: "paid",
  }),
  partnerName: z.string().optional().openapi({
    description: "Filter by the client's partner name (case-insensitive)",
    example: "Parceiro XYZ",
  }),
});

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

export function createOrderRoutes(
  orderService: OrderService = new OrderService(),
) {
  const orderRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

  // ─── Route Definitions ──────────────────────────────────────────

  const listOrdersRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Orders"],
    security: [{ bearerAuth: [] }],
    request: { query: orderQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: paginatedOrdersResponseSchema },
        },
        description: "Order list retrieved successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
    },
  });

  const createOrderRoute = createRoute({
    method: "post",
    path: "/",
    tags: ["Orders"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: createOrderSchema } },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: createOrderResponseSchema },
        },
        description: "Order created successfully",
      },
      400: {
        content: {
          "application/json": { schema: validationErrorResponseSchema },
        },
        description: "Validation error",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Client or assigned user not found",
      },
    },
  });

  const getOrderRoute = createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Orders"],
    security: [{ bearerAuth: [] }],
    request: { params: idParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: orderDetailWithHistoryResponseSchema },
        },
        description: "Order retrieved successfully",
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

  const updateOrderRoute = createRoute({
    method: "put",
    path: "/{id}",
    tags: ["Orders"],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        content: { "application/json": { schema: updateOrderSchema } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: updateOrderResponseSchema },
        },
        description: "Order updated successfully",
      },
      400: {
        content: {
          "application/json": { schema: validationErrorResponseSchema },
        },
        description: "Validation error",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Order or assigned user not found",
      },
    },
  });

  const changeStatusRoute = createRoute({
    method: "patch",
    path: "/{id}/status",
    tags: ["Orders"],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        content: { "application/json": { schema: changeOrderStatusSchema } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: changeStatusResponseSchema },
        },
        description: "Order status updated successfully",
      },
      400: {
        content: {
          "application/json": { schema: validationErrorResponseSchema },
        },
        description: "Validation error",
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

  const deleteOrderRoute = createRoute({
    method: "delete",
    path: "/{id}",
    tags: ["Orders"],
    security: [{ bearerAuth: [] }],
    request: { params: idParamSchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z
              .object({ success: z.literal(true), message: z.string() })
              .openapi("DeleteOrderResponse"),
          },
        },
        description: "Order deleted successfully",
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

  // ─── Middleware ─────────────────────────────────────────────────

  orderRoutes.use("/*", authMiddleware);
  orderRoutes.on("POST", "/", requireMinRole("OPERATOR"));
  orderRoutes.on(["PUT", "DELETE"], "/:id", requireMinRole("OPERATOR"));
  orderRoutes.on("PATCH", "/:id/status", requireMinRole("OPERATOR"));

  // ─── Route Handlers ─────────────────────────────────────────────

  orderRoutes.openapi(listOrdersRoute, async (c) => {
    const { page, limit, status, clientType, search, payment, partnerName } =
      c.req.valid("query");
    const { companyId } = getCompanyContext(c);
    const result = await orderService.getAll(
      companyId,
      page,
      limit,
      status,
      clientType,
      search,
      payment,
      partnerName,
    );
    return successResponse(c, result, 200, "Orders retrieved successfully");
  });

  orderRoutes.openapi(createOrderRoute, async (c) => {
    const body = c.req.valid("json");
    const { userId: createdById, companyId } = getCompanyContext(c);

    if (!(await orderService.clientExists(body.clientId, companyId))) {
      return errorResponse(c, "Client not found", 404);
    }
    if (
      typeof body.assignedUserId === "number" &&
      !(await orderService.userExists(body.assignedUserId, companyId))
    ) {
      return errorResponse(c, "Assigned user not found", 404);
    }

    const order = await orderService.create(body, createdById, companyId);
    return successResponse(c, order, 201, "Order created successfully");
  });

  orderRoutes.openapi(getOrderRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { companyId } = getCompanyContext(c);
    const order = await orderService.findById(id, companyId);

    if (!order) {
      return errorResponse(c, "Order not found", 404);
    }

    return successResponse(c, order, 200, "Order retrieved successfully");
  });

  orderRoutes.openapi(updateOrderRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const { companyId } = getCompanyContext(c);

    if (
      typeof body.assignedUserId === "number" &&
      !(await orderService.userExists(body.assignedUserId, companyId))
    ) {
      return errorResponse(c, "Assigned user not found", 404);
    }

    const order = await orderService.update(id, companyId, body);

    if (!order) {
      return errorResponse(c, "Order not found", 404);
    }

    return successResponse(c, order, 200, "Order updated successfully");
  });

  orderRoutes.openapi(changeStatusRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const { userId: changedById, companyId } = getCompanyContext(c);

    const order = await orderService.updateStatus(
      id,
      body,
      changedById,
      companyId,
    );

    if (!order) {
      return errorResponse(c, "Order not found", 404);
    }

    return successResponse(c, order, 200, "Order status updated successfully");
  });

  orderRoutes.openapi(deleteOrderRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { companyId } = getCompanyContext(c);
    const deleted = await orderService.delete(id, companyId);

    if (!deleted) {
      return errorResponse(c, "Order not found", 404);
    }

    return c.json(
      { success: true as const, message: "Order deleted successfully" },
      200,
    );
  });

  return orderRoutes;
}
