import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import {
  authMiddleware,
  getCompanyContext,
  type AuthVariables,
} from "../../middlewares/auth";
import { successResponse, errorResponse } from "../../utils/response";
import { errorResponseSchema } from "../../schemas/response";
import { OrderService } from "../order/order-service";
import { renderOrderPdf } from "../../utils/pdf";
import { signPdfShareToken, verifyPdfShareToken } from "../../utils/pdf-share";
import { pdfShareResponseSchema } from "./pdf-schema";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Builds the absolute public URL for a share token from the incoming request's
// origin. Behind a proxy this is the externally-visible host — strip/normalize
// forwarded headers at the proxy if it differs from the public domain.
function buildShareUrl(requestUrl: string, token: string): string {
  const { protocol, host } = new URL(requestUrl);
  return `${protocol}//${host}/api/pdf/shared/${token}`;
}

export function createPdfRoutes(
  orderService: OrderService = new OrderService(),
) {
  const pdfRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

  // Auth guards the order-scoped endpoints; /shared/:token is public by design.
  pdfRoutes.use("/orders/*", authMiddleware);

  // ─── Authenticated download ─────────────────────────────────────
  pdfRoutes.get("/orders/:id", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id === null) return errorResponse(c, "Order not found", 404);

    const { companyId } = getCompanyContext(c);
    const data = await orderService.getPdfData(id, companyId);
    if (!data) return errorResponse(c, "Order not found", 404);

    const pdf = await renderOrderPdf(data);
    return c.body(new Uint8Array(pdf), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.orderNumber}.pdf"`,
    });
  });

  // ─── Share-link generation (documented JSON response) ───────────
  const shareRoute = createRoute({
    method: "post",
    path: "/orders/{id}/share",
    tags: ["PDF"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.coerce
          .number()
          .int()
          .positive()
          .openapi({ param: { name: "id", in: "path" }, example: 1 }),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: pdfShareResponseSchema } },
        description: "Signed share link created",
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

  pdfRoutes.openapi(shareRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { companyId } = getCompanyContext(c);

    // The link is only worth issuing for an order the caller can actually see,
    // so resolve it first — this also keeps tenant scoping on the token's data.
    const data = await orderService.getPdfData(id, companyId);
    if (!data) return errorResponse(c, "Order not found", 404);

    const { token, expiresAt } = await signPdfShareToken(id, companyId);
    return successResponse(
      c,
      {
        url: buildShareUrl(c.req.url, token),
        expiresAt: expiresAt.toISOString(),
      },
      200,
      "Share link created",
    );
  });

  // ─── Public, signed download ────────────────────────────────────
  // Rendered inline so the shared link opens directly in a browser tab.
  pdfRoutes.get("/shared/:token", async (c) => {
    const result = await verifyPdfShareToken(c.req.param("token"));
    if (result.status === "expired") {
      throw new HTTPException(410, { message: "Este link expirou" });
    }
    if (result.status === "invalid") {
      return errorResponse(c, "Share link not found", 404);
    }

    const data = await orderService.getPdfData(
      result.orderId,
      result.companyId,
    );
    if (!data) return errorResponse(c, "Order not found", 404);

    const pdf = await renderOrderPdf(data);
    return c.body(new Uint8Array(pdf), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.orderNumber}.pdf"`,
    });
  });

  return pdfRoutes;
}
