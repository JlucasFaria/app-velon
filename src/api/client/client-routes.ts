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
import { ClientService } from "./client-service";
import {
  createClientSchema,
  updateClientSchema,
  createClientResponseSchema,
  updateClientResponseSchema,
  paginatedClientsResponseSchema,
  clientDetailWithOrdersResponseSchema,
  clientSearchResponseSchema,
  partnerNameSuggestionsResponseSchema,
} from "./client-schema";

const clientQuerySchema = paginationQuerySchema.extend({
  clientType: z.enum(["COUNTER", "PARTNER"]).optional().openapi({
    description: "Filter by client type",
    example: "COUNTER",
  }),
  search: z.string().optional().openapi({
    description: "Search by name or document",
    example: "João",
  }),
});

const idParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive()
    .openapi({
      param: { name: "id", in: "path" },
      description: "Client ID",
      example: 1,
    }),
});

export function createClientRoutes(
  clientService: ClientService = new ClientService(),
) {
  const clientRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

  // ─── Route Definitions ──────────────────────────────────────────

  const searchClientsRoute = createRoute({
    method: "get",
    path: "/search",
    tags: ["Clients"],
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        q: z.string().min(3).openapi({
          description: "Name search term (minimum 3 characters)",
          example: "João",
        }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: clientSearchResponseSchema },
        },
        description: "Search results (up to 5 clients)",
      },
      400: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Query too short (< 3 characters)",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
    },
  });

  const partnerNamesRoute = createRoute({
    method: "get",
    path: "/partner-names",
    tags: ["Clients"],
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        q: z.string().optional().openapi({
          description: "Filter partner names (optional)",
          example: "Parceiro",
        }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: partnerNameSuggestionsResponseSchema },
        },
        description: "Distinct partner name suggestions",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
    },
  });

  const listClientsRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Clients"],
    security: [{ bearerAuth: [] }],
    request: { query: clientQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: paginatedClientsResponseSchema },
        },
        description: "Client list retrieved successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
    },
  });

  const createClientRoute = createRoute({
    method: "post",
    path: "/",
    tags: ["Clients"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: createClientSchema } },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: createClientResponseSchema },
        },
        description: "Client created successfully",
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
      409: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Document already in use",
      },
    },
  });

  const getClientRoute = createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Clients"],
    security: [{ bearerAuth: [] }],
    request: { params: idParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: clientDetailWithOrdersResponseSchema },
        },
        description: "Client retrieved successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Client not found",
      },
    },
  });

  const updateClientRoute = createRoute({
    method: "put",
    path: "/{id}",
    tags: ["Clients"],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        content: { "application/json": { schema: updateClientSchema } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: updateClientResponseSchema },
        },
        description: "Client updated successfully",
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
        description: "Client not found",
      },
      409: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Document already in use",
      },
    },
  });

  const deleteClientRoute = createRoute({
    method: "delete",
    path: "/{id}",
    tags: ["Clients"],
    security: [{ bearerAuth: [] }],
    request: { params: idParamSchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z
              .object({ success: z.literal(true), message: z.string() })
              .openapi("DeleteClientResponse"),
          },
        },
        description: "Client deleted successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Client not found",
      },
    },
  });

  // ─── Middleware ─────────────────────────────────────────────────

  clientRoutes.use("/*", authMiddleware);
  clientRoutes.on("POST", "/", requireMinRole("OPERATOR"));
  clientRoutes.on(["PUT", "DELETE"], "/:id", requireMinRole("OPERATOR"));

  // ─── Route Handlers ─────────────────────────────────────────────

  clientRoutes.openapi(searchClientsRoute, async (c) => {
    const { q } = c.req.valid("query");
    const { companyId } = getCompanyContext(c);
    const results = await clientService.search(companyId, q);
    return successResponse(c, results, 200, "Search results retrieved");
  });

  clientRoutes.openapi(partnerNamesRoute, async (c) => {
    const { q } = c.req.valid("query");
    const { companyId } = getCompanyContext(c);
    const names = await clientService.getPartnerNameSuggestions(companyId, q);
    return successResponse(c, names, 200, "Partner name suggestions retrieved");
  });

  clientRoutes.openapi(listClientsRoute, async (c) => {
    const { page, limit, clientType, search } = c.req.valid("query");
    const { companyId } = getCompanyContext(c);
    const result = await clientService.getAll(
      companyId,
      page,
      limit,
      clientType,
      search,
    );
    return successResponse(c, result, 200, "Clients retrieved successfully");
  });

  clientRoutes.openapi(createClientRoute, async (c) => {
    const body = c.req.valid("json");
    const { companyId } = getCompanyContext(c);
    const client = await clientService.create(body, companyId);
    return successResponse(c, client, 201, "Client created successfully");
  });

  clientRoutes.openapi(getClientRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { companyId } = getCompanyContext(c);
    const client = await clientService.findById(id, companyId);

    if (!client) {
      return errorResponse(c, "Client not found", 404);
    }

    return successResponse(c, client, 200, "Client retrieved successfully");
  });

  clientRoutes.openapi(updateClientRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const { companyId } = getCompanyContext(c);
    const client = await clientService.update(id, companyId, body);

    if (!client) {
      return errorResponse(c, "Client not found", 404);
    }

    return successResponse(c, client, 200, "Client updated successfully");
  });

  clientRoutes.openapi(deleteClientRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { companyId } = getCompanyContext(c);
    const deleted = await clientService.delete(id, companyId);

    if (!deleted) {
      return errorResponse(c, "Client not found", 404);
    }

    return c.json(
      { success: true as const, message: "Client deleted successfully" },
      200,
    );
  });

  return clientRoutes;
}
