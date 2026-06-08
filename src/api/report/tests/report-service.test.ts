import { describe, it, expect, beforeEach, beforeAll } from "bun:test";
import { ReportService } from "../report-service";
import prisma from "../../../db/client";

const reportService = new ReportService();

let testUserId: number;
let testClientId: number;

// Fixed reference dates for deterministic filtering
const JUNE_2026 = new Date(2026, 5, 15); // June 15
const MAY_2026 = new Date(2026, 4, 10); // May 10

beforeAll(async () => {
  const user = await prisma.user.upsert({
    where: { email: "report-svc-test@example.com" },
    update: {},
    create: {
      email: "report-svc-test@example.com",
      password: "hashed",
      name: "Report Test User",
    },
  });
  testUserId = user.id;

  const client = await prisma.client.upsert({
    where: { document: "report-svc-doc-unique" },
    update: {},
    create: {
      name: "Report Test Client",
      document: "report-svc-doc-unique",
      clientType: "COUNTER",
    },
  });
  testClientId = client.id;
});

beforeEach(async () => {
  await prisma.serviceOrder.deleteMany();
});

const createOrder = async (
  overrides: Partial<{
    status:
      | "PENDING"
      | "IN_PROGRESS"
      | "AWAITING_CLIENT"
      | "COMPLETED"
      | "CANCELLED";
    value: string;
    updatedAt: Date;
    description: string;
  }> = {},
) => {
  const seq = await prisma.serviceOrder.count();
  return prisma.serviceOrder.create({
    data: {
      orderNumber: `OS-RPT-${String(seq + 1).padStart(3, "0")}`,
      description: overrides.description ?? "Test service",
      value: overrides.value ?? "100.00",
      clientId: testClientId,
      status: overrides.status ?? "PENDING",
      updatedAt: overrides.updatedAt ?? JUNE_2026,
      statusHistory: {
        create: { toStatus: "PENDING", changedById: testUserId },
      },
    },
  });
};

describe("ReportService", () => {
  describe("getMonthlyBilling", () => {
    it("should return empty result when no COMPLETED orders exist for the month", async () => {
      const result = await reportService.getMonthlyBilling(6, 2026);

      expect(result.month).toBe(6);
      expect(result.year).toBe(2026);
      expect(result.orderCount).toBe(0);
      expect(result.totalRevenue).toBe("0.00");
      expect(result.orders).toHaveLength(0);
    });

    it("should return only COMPLETED orders for the given month", async () => {
      await createOrder({
        status: "COMPLETED",
        value: "100.00",
        updatedAt: JUNE_2026,
      });
      await createOrder({
        status: "PENDING",
        value: "200.00",
        updatedAt: JUNE_2026,
      });
      await createOrder({
        status: "IN_PROGRESS",
        value: "300.00",
        updatedAt: JUNE_2026,
      });

      const result = await reportService.getMonthlyBilling(6, 2026);

      expect(result.orderCount).toBe(1);
      expect(result.totalRevenue).toBe("100.00");
    });

    it("should exclude COMPLETED orders from other months", async () => {
      await createOrder({
        status: "COMPLETED",
        value: "100.00",
        updatedAt: JUNE_2026,
      });
      await createOrder({
        status: "COMPLETED",
        value: "250.00",
        updatedAt: MAY_2026,
      });

      const result = await reportService.getMonthlyBilling(6, 2026);

      expect(result.orderCount).toBe(1);
      expect(result.totalRevenue).toBe("100.00");
    });

    it("should sum values of multiple COMPLETED orders correctly", async () => {
      await createOrder({
        status: "COMPLETED",
        value: "100.00",
        updatedAt: JUNE_2026,
      });
      await createOrder({
        status: "COMPLETED",
        value: "250.50",
        updatedAt: JUNE_2026,
      });
      await createOrder({
        status: "COMPLETED",
        value: "49.50",
        updatedAt: JUNE_2026,
      });

      const result = await reportService.getMonthlyBilling(6, 2026);

      expect(result.orderCount).toBe(3);
      expect(result.totalRevenue).toBe("400.00");
    });

    it("should embed order with client info and completedAt", async () => {
      await createOrder({
        status: "COMPLETED",
        value: "150.00",
        description: "Screen fix",
        updatedAt: JUNE_2026,
      });

      const result = await reportService.getMonthlyBilling(6, 2026);
      const order = result.orders[0]!;

      expect(order.description).toBe("Screen fix");
      expect(order.value).toBe("150");
      expect(order.completedAt).toBeDefined();
      expect(order.client.id).toBe(testClientId);
      expect(order.client.name).toBe("Report Test Client");
    });
  });

  describe("getOrdersSummary", () => {
    it("should return zero counts for all statuses when no orders exist", async () => {
      const summary = await reportService.getOrdersSummary();

      expect(summary.PENDING).toBe(0);
      expect(summary.IN_PROGRESS).toBe(0);
      expect(summary.AWAITING_CLIENT).toBe(0);
      expect(summary.COMPLETED).toBe(0);
      expect(summary.CANCELLED).toBe(0);
    });

    it("should count orders correctly per status", async () => {
      await createOrder({ status: "PENDING" });
      await createOrder({ status: "PENDING" });
      await createOrder({ status: "IN_PROGRESS" });
      await createOrder({ status: "COMPLETED" });

      const summary = await reportService.getOrdersSummary();

      expect(summary.PENDING).toBe(2);
      expect(summary.IN_PROGRESS).toBe(1);
      expect(summary.COMPLETED).toBe(1);
      expect(summary.AWAITING_CLIENT).toBe(0);
      expect(summary.CANCELLED).toBe(0);
    });

    it("should return all 5 status keys regardless of which are present", async () => {
      await createOrder({ status: "CANCELLED" });

      const summary = await reportService.getOrdersSummary();

      expect(Object.keys(summary)).toHaveLength(5);
      expect(summary.CANCELLED).toBe(1);
      expect(summary.PENDING).toBe(0);
    });
  });
});
