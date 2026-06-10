import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
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
import { CompanyService } from "./company-service";
import {
  updateCompanySchema,
  companyDetailResponseSchema,
} from "./company-schema";

export function createCompanyRoutes(
  companyService: CompanyService = new CompanyService(),
) {
  const companyRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

  // ─── Route Definitions ──────────────────────────────────────────

  const getCompanyRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Company"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        content: {
          "application/json": { schema: companyDetailResponseSchema },
        },
        description: "Current company retrieved successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      403: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "User has no company configured",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Company not found",
      },
    },
  });

  const updateCompanyRoute = createRoute({
    method: "patch",
    path: "/",
    tags: ["Company"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: updateCompanySchema } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: companyDetailResponseSchema },
        },
        description: "Company updated successfully",
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
      403: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "User has no company configured",
      },
    },
  });

  // ─── Middleware ─────────────────────────────────────────────────

  companyRoutes.use("/*", authMiddleware);

  // ─── Route Handlers ─────────────────────────────────────────────

  companyRoutes.openapi(getCompanyRoute, async (c) => {
    const { companyId } = getCompanyContext(c);
    const company = await companyService.findById(companyId);

    if (!company) {
      return errorResponse(c, "Company not found", 404);
    }

    return successResponse(c, company, 200, "Company retrieved successfully");
  });

  companyRoutes.openapi(updateCompanyRoute, async (c) => {
    const { companyId } = getCompanyContext(c);
    const body = c.req.valid("json");
    const company = await companyService.update(companyId, body);
    return successResponse(c, company, 200, "Company updated successfully");
  });

  return companyRoutes;
}
