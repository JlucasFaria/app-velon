import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
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
import { OrderService } from "../order/order-service";
import { renderOrderPdf, type OrderPdfData } from "../../utils/pdf";
import { signPdfShareToken, verifyPdfShareToken } from "../../utils/pdf-share";
import { emailTransport } from "../../utils/email";
import {
  pdfShareResponseSchema,
  sendOrderEmailBodySchema,
  sendOrderEmailResponseSchema,
} from "./pdf-schema";

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

const currencyBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function buildEmailHtml(
  data: OrderPdfData,
  shareUrl: string,
  expiresAt: Date,
  customBody?: string,
): string {
  const expDate = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(expiresAt);

  const intro =
    customBody ??
    `Segue o link para acessar a Ordem de Serviço ${data.orderNumber} referente ao serviço prestado por ${data.company.name}.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:sans-serif;color:#111;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="margin-top:0">${data.company.name}</h2>
  <p>${intro}</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr><td style="padding:6px 0;color:#666">OS</td><td style="padding:6px 0;font-weight:bold">${data.orderNumber}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Cliente</td><td style="padding:6px 0">${data.client.name}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Total</td><td style="padding:6px 0">${currencyBRL.format(Number(data.value))}</td></tr>
  </table>
  <a href="${shareUrl}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:4px">
    Acessar PDF da OS
  </a>
  <p style="margin-top:16px;font-size:12px;color:#999">Este link expira em ${expDate}.</p>
  ${data.company.footerNote ? `<p style="font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:12px;margin-top:24px">${data.company.footerNote}</p>` : ""}
</body>
</html>`;
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

  // ─── Send by email ──────────────────────────────────────────────
  const sendEmailRoute = createRoute({
    method: "post",
    path: "/orders/{id}/email",
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
      body: {
        content: { "application/json": { schema: sendOrderEmailBodySchema } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: sendOrderEmailResponseSchema },
        },
        description: "Email sent",
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

  pdfRoutes.openapi(sendEmailRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { to, subject, body } = c.req.valid("json");
    const { companyId } = getCompanyContext(c);

    const data = await orderService.getPdfData(id, companyId);
    if (!data) return errorResponse(c, "Order not found", 404);

    const { token, expiresAt } = await signPdfShareToken(id, companyId);
    const shareUrl = buildShareUrl(c.req.url, token);

    await emailTransport.send({
      to,
      subject:
        subject ??
        `Ordem de Serviço ${data.orderNumber} — ${data.company.name}`,
      html: buildEmailHtml(data, shareUrl, expiresAt, body),
    });

    return successResponse(
      c,
      { url: shareUrl, expiresAt: expiresAt.toISOString() },
      200,
      "Email sent",
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
