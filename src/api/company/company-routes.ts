import { mkdir, rm } from "fs/promises";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  authMiddleware,
  getAuthPayload,
  getCompanyContext,
  type AuthVariables,
} from "../../middlewares/auth";
import { successResponse, errorResponse } from "../../utils/response";
import {
  errorResponseSchema,
  validationErrorResponseSchema,
} from "../../schemas/response";
import {
  LOGO_MAX_BYTES,
  UPLOADS_DIR,
  UPLOADS_URL_PREFIX,
} from "../../config/constants";
import { requireMinRole } from "../../middlewares/permissions";
import { CompanyService } from "./company-service";
import {
  updateCompanySchema,
  companyDetailResponseSchema,
  createCompanySchema,
} from "./company-schema";
import { createMemberRoutes } from "./member-routes";

// Validate by file signature (magic bytes) rather than the client-supplied
// Content-Type, which can be spoofed. Returns the real extension or null.
function detectImageExt(bytes: Uint8Array): "png" | "jpg" | null {
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) return "png";

  const isJpg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  if (isJpg) return "jpg";

  return null;
}

export function createCompanyRoutes(
  companyService: CompanyService = new CompanyService(),
) {
  const companyRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

  // ─── Route Definitions ──────────────────────────────────────────

  const setupCompanyRoute = createRoute({
    method: "post",
    path: "/setup",
    tags: ["Company"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: createCompanySchema } },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: companyDetailResponseSchema },
        },
        description: "Company created and owner membership set up",
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
        description: "User already has a company configured",
      },
    },
  });

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

  // Company write operations restricted to admins.
  // POST /setup is excluded — caller has no company yet (no role to check).
  companyRoutes.on("PATCH", "/", requireMinRole("ADMIN"));
  companyRoutes.on("POST", "/logo", requireMinRole("ADMIN"));

  // Member management lives under /members; the auth middleware above covers it.
  companyRoutes.route("/members", createMemberRoutes());

  // ─── Route Handlers ─────────────────────────────────────────────

  companyRoutes.openapi(setupCompanyRoute, async (c) => {
    const payload = getAuthPayload(c);
    if (payload.companyId !== null) {
      return errorResponse(c, "Empresa já configurada para este usuário", 409);
    }
    const data = c.req.valid("json");
    const company = await companyService.createWithOwner(payload.id, data);
    return successResponse(c, company, 201, "Empresa criada com sucesso");
  });

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

  // Logo upload (multipart/form-data, field "logo"). Defined as a plain route
  // rather than via createRoute because binary multipart bodies don't map
  // cleanly onto the zod-openapi document. The 2 MB cap is enforced both by
  // the path-aware body limit in index.ts and re-checked here.
  companyRoutes.post("/logo", async (c) => {
    const { companyId } = getCompanyContext(c);

    const body = await c.req.parseBody();
    const file = body["logo"];

    if (!(file instanceof File)) {
      return errorResponse(c, "No file uploaded (expected field 'logo')", 400);
    }
    if (file.size > LOGO_MAX_BYTES) {
      return errorResponse(c, "File too large (max 2 MB).", 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = detectImageExt(bytes);
    if (!ext) {
      return errorResponse(c, "Invalid file format. Use PNG or JPG.", 400);
    }

    const dir = `${UPLOADS_DIR}/logos`;
    await mkdir(dir, { recursive: true });
    const filename = `company-${companyId}-${Date.now()}.${ext}`;
    await Bun.write(`${dir}/${filename}`, bytes);

    const logoUrl = `${UPLOADS_URL_PREFIX}/logos/${filename}`;

    // Remove the previous logo file so replaced uploads don't pile up. Best
    // effort: never fail the request over a leftover file.
    const previous = await companyService.findById(companyId);
    const oldName = previous?.logoUrl?.startsWith(
      `${UPLOADS_URL_PREFIX}/logos/`,
    )
      ? previous.logoUrl.split("/").pop()
      : undefined;
    if (oldName && oldName !== filename) {
      await rm(`${dir}/${oldName}`, { force: true }).catch(() => {});
    }

    const company = await companyService.updateLogo(companyId, logoUrl);
    return successResponse(c, company, 200, "Logo updated successfully");
  });

  return companyRoutes;
}
