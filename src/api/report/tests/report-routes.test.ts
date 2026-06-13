import { describe, it, expect, beforeEach } from "bun:test";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import { signTestToken, createTestCompany } from "../../../test-utils/company";

describe("Report Routes", () => {
  let token: string;
  let testUserId: number;
  let testClientId: number;
  let companyId: number;

  // Unique IP to isolate rate-limit bucket from other test files
  const IP = "127.0.0.14";

  // Fixed dates for deterministic billing filter assertions
  const JUNE_2026 = new Date(2026, 5, 15);
  const MAY_2026 = new Date(2026, 4, 10);

  beforeEach(async () => {
    await prisma.receipt.deleteMany();
    await prisma.serviceOrder.deleteMany();

    companyId = await createTestCompany("Report Routes Company");

    const user = await prisma.user.upsert({
      where: { email: "report-routes-test@example.com" },
      update: {},
      create: {
        email: "report-routes-test@example.com",
        password: "hashed",
        name: "Report Routes Tester",
      },
    });
    testUserId = user.id;

    const client = await prisma.client.create({
      data: {
        name: "Report Routes Client",
        document: "report-routes-doc-unique",
        clientType: "COUNTER",
        companyId,
      },
    });
    testClientId = client.id;

    token = await signTestToken(testUserId, user.email, companyId, "ADMIN");
  });

  const h = (extra?: Record<string, string>) => ({
    "X-Forwarded-For": IP,
    Authorization: `Bearer ${token}`,
    ...extra,
  });

  // Creates an order; when status is COMPLETED, records a COMPLETED
  // StatusHistory entry at `completedAt` (the date billing filters on).
  const createOrder = async (overrides: {
    status:
      | "PENDING"
      | "IN_PROGRESS"
      | "AWAITING_CLIENT"
      | "COMPLETED"
      | "CANCELLED";
    value?: string;
    completedAt?: Date;
  }) => {
    const seq = await prisma.serviceOrder.count();
    const completedAt = overrides.completedAt ?? JUNE_2026;
    return prisma.serviceOrder.create({
      data: {
        orderNumber: `OS-RPT-${String(seq + 1).padStart(3, "0")}`,
        description: "Test service",
        value: overrides.value ?? "100.00",
        clientId: testClientId,
        companyId,
        status: overrides.status,
        statusHistory: {
          create:
            overrides.status === "COMPLETED"
              ? [
                  { toStatus: "PENDING", changedById: testUserId },
                  {
                    fromStatus: "PENDING",
                    toStatus: "COMPLETED",
                    changedById: testUserId,
                    changedAt: completedAt,
                  },
                ]
              : [{ toStatus: "PENDING", changedById: testUserId }],
        },
      },
    });
  };

  // ─── Auth guard ───────────────────────────────────────────────────

  describe("auth guard", () => {
    it("should return 401 on GET /api/reports/billing without token", async () => {
      const res = await app.request("/api/reports/billing?month=6&year=2026", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 401 on GET /api/reports/summary without token", async () => {
      const res = await app.request("/api/reports/summary", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/reports/billing ─────────────────────────────────────

  describe("GET /api/reports/billing", () => {
    it("should return billing report for a given month", async () => {
      await createOrder({
        status: "COMPLETED",
        value: "250.00",
        completedAt: JUNE_2026,
      });
      await createOrder({
        status: "COMPLETED",
        value: "100.00",
        completedAt: JUNE_2026,
      });

      const res = await app.request("/api/reports/billing?month=6&year=2026", {
        headers: h(),
      });
      const body = (await res.json()) as {
        success: boolean;
        data: {
          month: number;
          year: number;
          totalRevenue: string;
          orderCount: number;
          orders: unknown[];
        };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.month).toBe(6);
      expect(body.data.year).toBe(2026);
      expect(body.data.orderCount).toBe(2);
      expect(body.data.totalRevenue).toBe("350.00");
      expect(body.data.orders).toHaveLength(2);
    });

    it("should return empty result when no COMPLETED orders in the month", async () => {
      await createOrder({ status: "PENDING" });

      const res = await app.request("/api/reports/billing?month=6&year=2026", {
        headers: h(),
      });
      const body = (await res.json()) as {
        data: { orderCount: number; totalRevenue: string };
      };

      expect(res.status).toBe(200);
      expect(body.data.orderCount).toBe(0);
      expect(body.data.totalRevenue).toBe("0.00");
    });

    it("should exclude orders completed in other months", async () => {
      await createOrder({
        status: "COMPLETED",
        value: "500.00",
        completedAt: MAY_2026,
      });

      const res = await app.request("/api/reports/billing?month=6&year=2026", {
        headers: h(),
      });
      const body = (await res.json()) as {
        data: { orderCount: number };
      };

      expect(res.status).toBe(200);
      expect(body.data.orderCount).toBe(0);
    });

    it("should return 400 when month param is missing", async () => {
      const res = await app.request("/api/reports/billing?year=2026", {
        headers: h(),
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 when year param is missing", async () => {
      const res = await app.request("/api/reports/billing?month=6", {
        headers: h(),
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 when month is out of range", async () => {
      const res = await app.request("/api/reports/billing?month=13&year=2026", {
        headers: h(),
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 when month is zero", async () => {
      const res = await app.request("/api/reports/billing?month=0&year=2026", {
        headers: h(),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/reports/summary ─────────────────────────────────────

  describe("GET /api/reports/summary", () => {
    it("should return all zero counts when no orders exist", async () => {
      const res = await app.request("/api/reports/summary", { headers: h() });
      const body = (await res.json()) as {
        success: boolean;
        data: Record<string, number>;
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.PENDING).toBe(0);
      expect(body.data.IN_PROGRESS).toBe(0);
      expect(body.data.AWAITING_CLIENT).toBe(0);
      expect(body.data.COMPLETED).toBe(0);
      expect(body.data.CANCELLED).toBe(0);
    });

    it("should return correct counts per status", async () => {
      await createOrder({ status: "PENDING" });
      await createOrder({ status: "PENDING" });
      await createOrder({ status: "COMPLETED" });

      const res = await app.request("/api/reports/summary", { headers: h() });
      const body = (await res.json()) as {
        data: Record<string, number>;
      };

      expect(res.status).toBe(200);
      expect(body.data.PENDING).toBe(2);
      expect(body.data.COMPLETED).toBe(1);
      expect(body.data.IN_PROGRESS).toBe(0);
    });
  });

  // ─── Security headers ─────────────────────────────────────────────

  describe("security headers", () => {
    it("should include X-Content-Type-Options: nosniff", async () => {
      const res = await app.request("/api/reports/summary", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });
  });

  // ─── GET /api/reports/orders ──────────────────────────────────────

  // Creates an order with items and optional paymentStatus for the all-orders tests.
  const createOrderWithItems = async (
    overrides: {
      status?:
        | "PENDING"
        | "IN_PROGRESS"
        | "AWAITING_CLIENT"
        | "COMPLETED"
        | "CANCELLED";
      value?: string;
      completedAt?: Date;
      paymentStatus?:
        | "UNPAID"
        | "PAID_PIX"
        | "PAID_CREDIT"
        | "PAID_DEBIT"
        | "PAID_CASH"
        | "PAID_TRANSFER"
        | "PAID_OTHER";
      items?: Array<{
        description: string;
        category?: string | null;
        unitValue: string;
        quantity: number;
        subtotal: string;
      }>;
    } = {},
  ) => {
    const seq = await prisma.serviceOrder.count();
    const status = overrides.status ?? "PENDING";
    const value = overrides.value ?? "100.00";
    const completedAt = overrides.completedAt ?? JUNE_2026;
    return prisma.serviceOrder.create({
      data: {
        orderNumber: `OS-RPTR-${String(seq + 1).padStart(3, "0")}`,
        description: "Test service",
        value,
        clientId: testClientId,
        companyId,
        status,
        paymentStatus: overrides.paymentStatus ?? "UNPAID",
        items: {
          create: overrides.items ?? [
            {
              description: "Serviço",
              category: null,
              unitValue: value,
              quantity: 1,
              subtotal: value,
            },
          ],
        },
        statusHistory: {
          create:
            status === "COMPLETED"
              ? [
                  { toStatus: "PENDING", changedById: testUserId },
                  {
                    fromStatus: "PENDING",
                    toStatus: "COMPLETED",
                    changedById: testUserId,
                    changedAt: completedAt,
                  },
                ]
              : [{ toStatus: status, changedById: testUserId }],
        },
      },
    });
  };

  describe("GET /api/reports/orders", () => {
    it("should return 401 without token", async () => {
      const res = await app.request("/api/reports/orders", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return orders with totals structure", async () => {
      await createOrderWithItems({
        value: "150.00",
        paymentStatus: "PAID_PIX",
      });

      const res = await app.request("/api/reports/orders", { headers: h() });
      const body = (await res.json()) as {
        success: boolean;
        data: {
          orders: Array<{
            orderNumber: string;
            client: { id: number; name: string };
            createdAt: string;
            completedAt: string | null;
            total: string;
            honorario: string;
            paymentStatus: string;
            status: string;
          }>;
          totals: {
            sumTotal: string;
            sumHonorario: string;
            totalReceived: string;
          };
        };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.orders).toHaveLength(1);
      expect(body.data.orders[0]!.total).toBe("150.00");
      expect(body.data.orders[0]!.paymentStatus).toBe("PAID_PIX");
      expect(body.data.totals.sumTotal).toBe("150.00");
      expect(body.data.totals.totalReceived).toBe("150.00");
    });

    it("should filter by status query param", async () => {
      await createOrderWithItems({ status: "PENDING" });
      await createOrderWithItems({ status: "COMPLETED" });

      const res = await app.request("/api/reports/orders?status=COMPLETED", {
        headers: h(),
      });
      const body = (await res.json()) as {
        data: { orders: Array<{ status: string }> };
      };

      expect(res.status).toBe(200);
      expect(body.data.orders).toHaveLength(1);
      expect(body.data.orders[0]!.status).toBe("COMPLETED");
    });

    it("should filter by partnerName query param", async () => {
      const partnerClient = await prisma.client.create({
        data: {
          name: "Routes Partner Co",
          document: `routes-partner-doc-${crypto.randomUUID()}`,
          clientType: "PARTNER",
          partnerName: "Beta Partner",
          companyId,
        },
      });
      await createOrderWithItems(); // default COUNTER client, no partner
      await prisma.serviceOrder.create({
        data: {
          orderNumber: "OS-RPTR-PARTNER",
          description: "Partner order",
          value: "100.00",
          clientId: partnerClient.id,
          companyId,
          status: "PENDING",
          items: {
            create: [
              {
                description: "Serviço",
                unitValue: "100.00",
                quantity: 1,
                subtotal: "100.00",
              },
            ],
          },
          statusHistory: {
            create: [{ toStatus: "PENDING", changedById: testUserId }],
          },
        },
      });

      const res = await app.request("/api/reports/orders?partnerName=beta", {
        headers: h(),
      });
      const body = (await res.json()) as {
        data: { orders: Array<{ client: { id: number } }> };
      };

      expect(res.status).toBe(200);
      expect(body.data.orders).toHaveLength(1);
      expect(body.data.orders[0]!.client.id).toBe(partnerClient.id);
    });

    it("should return empty orders list and zero totals when no orders match filters", async () => {
      await createOrderWithItems({ status: "PENDING" });

      const res = await app.request("/api/reports/orders?status=CANCELLED", {
        headers: h(),
      });
      const body = (await res.json()) as {
        data: { orders: unknown[]; totals: { sumTotal: string } };
      };

      expect(res.status).toBe(200);
      expect(body.data.orders).toHaveLength(0);
      expect(body.data.totals.sumTotal).toBe("0.00");
    });
  });

  // ─── GET /api/reports/orders/export/csv ──────────────────────────

  describe("GET /api/reports/orders/export/csv", () => {
    it("should return 401 without token", async () => {
      const res = await app.request("/api/reports/orders/export/csv", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return CSV with correct content-type", async () => {
      const res = await app.request("/api/reports/orders/export/csv", {
        headers: h(),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      expect(res.headers.get("Content-Disposition")).toContain("attachment");
      expect(res.headers.get("Content-Disposition")).toContain(".csv");
    });

    it("should include header row in CSV", async () => {
      const res = await app.request("/api/reports/orders/export/csv", {
        headers: h(),
      });
      const text = await res.text();

      expect(text).toContain("Nº OS");
      expect(text).toContain("Cliente");
      expect(text).toContain("Honorário");
      expect(text).toContain("Pagamento");
    });

    it("should include order data and totals row in CSV", async () => {
      await createOrderWithItems({
        value: "250.00",
        paymentStatus: "PAID_PIX",
        items: [
          {
            description: "Honorário",
            category: "Honorário",
            unitValue: "250.00",
            quantity: 1,
            subtotal: "250.00",
          },
        ],
      });

      const res = await app.request("/api/reports/orders/export/csv", {
        headers: h(),
      });
      const text = await res.text();

      expect(text).toContain("250.00");
      expect(text).toContain("Total geral");
    });

    it("should respect status filter in CSV export", async () => {
      await createOrderWithItems({ status: "PENDING", value: "100.00" });
      await createOrderWithItems({ status: "CANCELLED", value: "200.00" });

      const res = await app.request(
        "/api/reports/orders/export/csv?status=CANCELLED",
        { headers: h() },
      );
      const text = await res.text();
      const lines = text.split("\n").filter((l) => l.trim() !== "");

      // header + 1 data row + totals row = 3 non-empty lines
      expect(lines).toHaveLength(3);
    });
  });

  // ─── GET /api/reports/orders/export/pdf ──────────────────────────

  describe("GET /api/reports/orders/export/pdf", () => {
    it("should return 401 without token", async () => {
      const res = await app.request("/api/reports/orders/export/pdf", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return PDF with correct content-type and non-empty body", async () => {
      const res = await app.request("/api/reports/orders/export/pdf", {
        headers: h(),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/pdf");
      expect(res.headers.get("Content-Disposition")).toContain("attachment");
      expect(res.headers.get("Content-Disposition")).toContain(".pdf");

      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it("should respect status filter in PDF export", async () => {
      await createOrderWithItems({ status: "PENDING", value: "100.00" });
      await createOrderWithItems({ status: "CANCELLED", value: "200.00" });

      const res = await app.request(
        "/api/reports/orders/export/pdf?status=CANCELLED",
        { headers: h() },
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/pdf");
    });
  });
});
