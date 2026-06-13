import { OpenAPIHono } from "@hono/zod-openapi";
import {
  authMiddleware,
  getCompanyContext,
  type AuthVariables,
} from "../../middlewares/auth";
import { errorResponse } from "../../utils/response";
import { OrderService } from "../order/order-service";
import { renderOrderPdf } from "../../utils/pdf";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function createPdfRoutes(
  orderService: OrderService = new OrderService(),
) {
  const pdfRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

  pdfRoutes.use("/orders/*", authMiddleware);

  // Authenticated download — the user saves the PDF and shares it however they
  // like, so no server-side email/link sharing is needed.
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

  return pdfRoutes;
}
