import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import {
  authMiddleware,
  getCompanyContext,
  type AuthVariables,
} from "../../middlewares/auth";
import { successResponse, errorResponse } from "../../utils/response";
import {
  errorResponseSchema,
  validationErrorResponseSchema,
} from "../../schemas/response";
import { requireMinRole } from "../../middlewares/permissions";
import { TemplateService } from "./template-service";
import {
  createTemplateSchema,
  updateTemplateSchema,
  createTemplateResponseSchema,
  updateTemplateResponseSchema,
  templateListResponseSchema,
  templateDetailResponseSchema,
} from "./template-schema";

const idParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive()
    .openapi({
      param: { name: "id", in: "path" },
      description: "Template ID",
      example: 1,
    }),
});

export function createTemplateRoutes(
  templateService: TemplateService = new TemplateService(),
) {
  const templateRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

  // ─── Route Definitions ──────────────────────────────────────────

  const listTemplatesRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Templates"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        content: {
          "application/json": { schema: templateListResponseSchema },
        },
        description: "Template list retrieved successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
    },
  });

  const createTemplateRoute = createRoute({
    method: "post",
    path: "/",
    tags: ["Templates"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: createTemplateSchema } },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: createTemplateResponseSchema },
        },
        description: "Template created successfully",
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
        description: "Template name already in use",
      },
    },
  });

  const getTemplateRoute = createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Templates"],
    security: [{ bearerAuth: [] }],
    request: { params: idParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: templateDetailResponseSchema },
        },
        description: "Template retrieved successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Template not found",
      },
    },
  });

  const updateTemplateRoute = createRoute({
    method: "put",
    path: "/{id}",
    tags: ["Templates"],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        content: { "application/json": { schema: updateTemplateSchema } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: updateTemplateResponseSchema },
        },
        description: "Template updated successfully",
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
        description: "Template not found",
      },
      409: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Template name already in use",
      },
    },
  });

  const deleteTemplateRoute = createRoute({
    method: "delete",
    path: "/{id}",
    tags: ["Templates"],
    security: [{ bearerAuth: [] }],
    request: { params: idParamSchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z
              .object({ success: z.literal(true), message: z.string() })
              .openapi("DeleteServiceTemplateResponse"),
          },
        },
        description: "Template deleted successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Template not found",
      },
    },
  });

  // ─── Middleware ─────────────────────────────────────────────────

  templateRoutes.use("/*", authMiddleware);
  templateRoutes.on("POST", "/", requireMinRole("OPERATOR"));
  templateRoutes.on(["PUT", "DELETE"], "/:id", requireMinRole("OPERATOR"));

  // ─── Route Handlers ─────────────────────────────────────────────

  templateRoutes.openapi(listTemplatesRoute, async (c) => {
    const { companyId } = getCompanyContext(c);
    const templates = await templateService.getAll(companyId);
    return successResponse(
      c,
      templates,
      200,
      "Templates retrieved successfully",
    );
  });

  templateRoutes.openapi(createTemplateRoute, async (c) => {
    const body = c.req.valid("json");
    const { companyId } = getCompanyContext(c);
    const template = await templateService.create(body, companyId);
    return successResponse(c, template, 201, "Template created successfully");
  });

  templateRoutes.openapi(getTemplateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { companyId } = getCompanyContext(c);
    const template = await templateService.findById(id, companyId);

    if (!template) {
      return errorResponse(c, "Template not found", 404);
    }

    return successResponse(c, template, 200, "Template retrieved successfully");
  });

  templateRoutes.openapi(updateTemplateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const { companyId } = getCompanyContext(c);
    const template = await templateService.update(id, companyId, body);

    if (!template) {
      return errorResponse(c, "Template not found", 404);
    }

    return successResponse(c, template, 200, "Template updated successfully");
  });

  templateRoutes.openapi(deleteTemplateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { companyId } = getCompanyContext(c);
    const deleted = await templateService.delete(id, companyId);

    if (!deleted) {
      return errorResponse(c, "Template not found", 404);
    }

    return c.json(
      { success: true as const, message: "Template deleted successfully" },
      200,
    );
  });

  return templateRoutes;
}
