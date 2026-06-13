import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  authMiddleware,
  getCompanyContext,
  type AuthVariables,
} from "../../middlewares/auth";
import { errorResponse, successResponse } from "../../utils/response";
import { errorResponseSchema } from "../../schemas/response";
import { ReportService } from "./report-service";
import {
  allOrdersQuerySchema,
  allOrdersResponseSchema,
  billingQuerySchema,
  monthlyBillingResponseSchema,
  ordersSummaryResponseSchema,
} from "./report-schema";
import { generateReportCsv } from "../../utils/csv";
import { renderReportPdf } from "../../utils/pdf";

export function createReportRoutes(
  reportService: ReportService = new ReportService(),
) {
  const reportRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

  // ─── Route Definitions ──────────────────────────────────────────

  const monthlyBillingRoute = createRoute({
    method: "get",
    path: "/billing",
    tags: ["Reports"],
    security: [{ bearerAuth: [] }],
    request: { query: billingQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: monthlyBillingResponseSchema },
        },
        description: "Monthly billing report retrieved successfully",
      },
      400: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Invalid or missing month/year query params",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
    },
  });

  const ordersSummaryRoute = createRoute({
    method: "get",
    path: "/summary",
    tags: ["Reports"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        content: {
          "application/json": { schema: ordersSummaryResponseSchema },
        },
        description: "Orders summary retrieved successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
    },
  });

  const allOrdersRoute = createRoute({
    method: "get",
    path: "/orders",
    tags: ["Reports"],
    security: [{ bearerAuth: [] }],
    request: { query: allOrdersQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: allOrdersResponseSchema },
        },
        description: "All orders report retrieved successfully",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
    },
  });

  // ─── Middleware ─────────────────────────────────────────────────

  reportRoutes.use("/*", authMiddleware);

  // ─── Route Handlers ─────────────────────────────────────────────

  reportRoutes.openapi(monthlyBillingRoute, async (c) => {
    const { month, year } = c.req.valid("query");
    const { companyId } = getCompanyContext(c);
    const result = await reportService.getMonthlyBilling(
      companyId,
      month,
      year,
    );
    return successResponse(
      c,
      result,
      200,
      "Monthly billing retrieved successfully",
    );
  });

  reportRoutes.openapi(ordersSummaryRoute, async (c) => {
    const { companyId } = getCompanyContext(c);
    const summary = await reportService.getOrdersSummary(companyId);
    return successResponse(
      c,
      summary,
      200,
      "Orders summary retrieved successfully",
    );
  });

  reportRoutes.openapi(allOrdersRoute, async (c) => {
    const filters = c.req.valid("query");
    const { companyId } = getCompanyContext(c);
    const result = await reportService.getAllOrders(companyId, filters);
    return successResponse(
      c,
      result,
      200,
      "All orders report retrieved successfully",
    );
  });

  // ─── Export routes (binary responses — plain .get() handlers) ────────

  reportRoutes.get("/orders/export/csv", async (c) => {
    const parsed = allOrdersQuerySchema.safeParse(c.req.query());
    if (!parsed.success)
      return errorResponse(c, "Invalid query parameters", 400);

    const { companyId } = getCompanyContext(c);
    const { orders, totals } = await reportService.getAllOrders(
      companyId,
      parsed.data,
    );
    const csv = generateReportCsv(orders, totals);

    const filename = `relatorio-os-${new Date().toISOString().slice(0, 10)}.csv`;
    return c.body(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
  });

  reportRoutes.get("/orders/export/pdf", async (c) => {
    const parsed = allOrdersQuerySchema.safeParse(c.req.query());
    if (!parsed.success)
      return errorResponse(c, "Invalid query parameters", 400);

    const { companyId } = getCompanyContext(c);
    const { orders, totals } = await reportService.getAllOrders(
      companyId,
      parsed.data,
    );

    const pdf = await renderReportPdf({
      rows: orders,
      totals,
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
    });

    const filename = `relatorio-os-${new Date().toISOString().slice(0, 10)}.pdf`;
    return c.body(new Uint8Array(pdf), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
  });

  return reportRoutes;
}
