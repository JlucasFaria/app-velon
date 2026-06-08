import { describe, it, expect, beforeEach } from "bun:test";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import { sign } from "hono/jwt";
import { env } from "../../../config/env";

describe("Report Routes", () => {
  let token: string;
  let testUserId: number;
  let testClientId: number;

  // Unique IP to isolate rate-limit bucket from other test files
  const IP = "127.0.0.14";

  // Fixed dates for deterministic billing filter assertions
  const JUNE_2026 = new Date(2026, 5, 15);
  const MAY_2026 = new Date(2026, 4, 10);

  beforeEach(async () => {
    await prisma.receipt.deleteMany();
    await prisma.serviceOrder.deleteMany();

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

    const client = await prisma.client.upsert({
      where: { document: "report-routes-doc-unique" },
      update: {},
      create: {
        name: "Report Routes Client",
        document: "report-routes-doc-unique",
        clientType: "COUNTER",
      },
    });
    testClientId = client.id;

    token = await sign(
      {
        id: testUserId,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      },
      env.JWT_SECRET,
    );
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
});
