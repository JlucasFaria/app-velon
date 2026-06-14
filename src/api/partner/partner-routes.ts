import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import {
  authMiddleware,
  getCompanyContext,
  type AuthVariables,
} from "../../middlewares/auth";
import { successResponse } from "../../utils/response";
import {
  errorResponseSchema,
  validationErrorResponseSchema,
} from "../../schemas/response";
import { requireMinRole } from "../../middlewares/permissions";
import { PartnerService } from "./partner-service";
import {
  createPartnerSchema,
  partnerListResponseSchema,
  createPartnerResponseSchema,
} from "./partner-schema";

export function createPartnerRoutes(
  partnerService: PartnerService = new PartnerService(),
) {
  const partnerRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

  // ─── Route Definitions ──────────────────────────────────────────

  const listPartnersRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Partners"],
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        q: z.string().optional().openapi({
          description: "Filter by name (case-insensitive, partial match)",
          example: "Parceiro",
        }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: partnerListResponseSchema },
        },
        description: "Partner list retrieved successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      403: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Insufficient permissions or no active company",
      },
    },
  });

  const createPartnerRoute = createRoute({
    method: "post",
    path: "/",
    tags: ["Partners"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: createPartnerSchema } },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: createPartnerResponseSchema },
        },
        description: "Partner created successfully",
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
        description: "Insufficient permissions or no active company",
      },
      409: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Partner name already in use in this company",
      },
    },
  });

  // ─── Middleware ─────────────────────────────────────────────────

  partnerRoutes.use("/*", authMiddleware);
  partnerRoutes.use("/*", requireMinRole("OPERATOR"));

  // ─── Route Handlers ─────────────────────────────────────────────

  partnerRoutes.openapi(listPartnersRoute, async (c) => {
    const { q } = c.req.valid("query");
    const { companyId } = getCompanyContext(c);
    const partners = await partnerService.getAll(companyId, q);
    return successResponse(c, partners, 200, "Partners retrieved successfully");
  });

  partnerRoutes.openapi(createPartnerRoute, async (c) => {
    const body = c.req.valid("json");
    const { companyId } = getCompanyContext(c);
    const partner = await partnerService.create(companyId, body);
    return successResponse(c, partner, 201, "Partner created successfully");
  });

  return partnerRoutes;
}
