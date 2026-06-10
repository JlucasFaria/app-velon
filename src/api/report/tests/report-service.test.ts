import { describe, it, expect, beforeEach, beforeAll } from "bun:test";
import { ReportService } from "../report-service";
import prisma from "../../../db/client";
import { createTestCompany } from "../../../test-utils/company";

const reportService = new ReportService();

let testUserId: number;
let testClientId: number;
let companyId: number;

// Fixed reference dates for deterministic filtering
const JUNE_2026 = new Date(2026, 5, 15); // June 15
const MAY_2026 = new Date(2026, 4, 10); // May 10

beforeAll(async () => {
  companyId = await createTestCompany("Report Service Company");

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

  const client = await prisma.client.create({
    data: {
      name: "Report Test Client",
      document: "report-svc-doc-unique",
      clientType: "COUNTER",
      companyId,
    },
  });
  testClientId = client.id;
});

beforeEach(async () => {
  await prisma.serviceOrder.deleteMany();
});

// Creates an order; when status is COMPLETED, records a COMPLETED StatusHistory
// entry at `completedAt` (the date billing actually filters on).
const createOrder = async (
  overrides: Partial<{
    status:
      | "PENDING"
      | "IN_PROGRESS"
      | "AWAITING_CLIENT"
      | "COMPLETED"
      | "CANCELLED";
    value: string;
    completedAt: Date;
    description: string;
  }> = {},
) => {
  const seq = await prisma.serviceOrder.count();
  const status = overrides.status ?? "PENDING";
  const completedAt = overrides.completedAt ?? JUNE_2026;
  return prisma.serviceOrder.create({
    data: {
      orderNumber: `OS-RPT-${String(seq + 1).padStart(3, "0")}`,
      description: overrides.description ?? "Test service",
      value: overrides.value ?? "100.00",
      clientId: testClientId,
      companyId,
      status,
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
            : [{ toStatus: "PENDING", changedById: testUserId }],
      },
    },
  });
};

describe("ReportService", () => {
  describe("getMonthlyBilling", () => {
    it("should return empty result when no COMPLETED orders exist for the month", async () => {
      const result = await reportService.getMonthlyBilling(companyId, 6, 2026);

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
        completedAt: JUNE_2026,
      });
      await createOrder({ status: "PENDING", value: "200.00" });
      await createOrder({ status: "IN_PROGRESS", value: "300.00" });

      const result = await reportService.getMonthlyBilling(companyId, 6, 2026);

      expect(result.orderCount).toBe(1);
      expect(result.totalRevenue).toBe("100.00");
    });

    it("should exclude orders completed in other months", async () => {
      await createOrder({
        status: "COMPLETED",
        value: "100.00",
        completedAt: JUNE_2026,
      });
      await createOrder({
        status: "COMPLETED",
        value: "250.00",
        completedAt: MAY_2026,
      });

      const result = await reportService.getMonthlyBilling(companyId, 6, 2026);

      expect(result.orderCount).toBe(1);
      expect(result.totalRevenue).toBe("100.00");
    });

    it("should sum values of multiple COMPLETED orders correctly", async () => {
      await createOrder({
        status: "COMPLETED",
        value: "100.00",
        completedAt: JUNE_2026,
      });
      await createOrder({
        status: "COMPLETED",
        value: "250.50",
        completedAt: JUNE_2026,
      });
      await createOrder({
        status: "COMPLETED",
        value: "49.50",
        completedAt: JUNE_2026,
      });

      const result = await reportService.getMonthlyBilling(companyId, 6, 2026);

      expect(result.orderCount).toBe(3);
      expect(result.totalRevenue).toBe("400.00");
    });

    it("should embed order with client info and completedAt", async () => {
      await createOrder({
        status: "COMPLETED",
        value: "150.00",
        description: "Screen fix",
        completedAt: JUNE_2026,
      });

      const result = await reportService.getMonthlyBilling(companyId, 6, 2026);
      const order = result.orders[0]!;

      expect(order.description).toBe("Screen fix");
      expect(order.value).toBe("150.00");
      expect(order.completedAt).toBeDefined();
      expect(order.client.id).toBe(testClientId);
      expect(order.client.name).toBe("Report Test Client");
    });

    it("should not count an order completed in the month but later cancelled", async () => {
      // Completed in June, then moved to CANCELLED — must not appear in billing
      const order = await createOrder({
        status: "COMPLETED",
        value: "500.00",
        completedAt: JUNE_2026,
      });
      await prisma.serviceOrder.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });

      const result = await reportService.getMonthlyBilling(companyId, 6, 2026);

      expect(result.orderCount).toBe(0);
      expect(result.totalRevenue).toBe("0.00");
    });
  });

  describe("getOrdersSummary", () => {
    it("should return zero counts for all statuses when no orders exist", async () => {
      const summary = await reportService.getOrdersSummary(companyId);

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

      const summary = await reportService.getOrdersSummary(companyId);

      expect(summary.PENDING).toBe(2);
      expect(summary.IN_PROGRESS).toBe(1);
      expect(summary.COMPLETED).toBe(1);
      expect(summary.AWAITING_CLIENT).toBe(0);
      expect(summary.CANCELLED).toBe(0);
    });

    it("should return all 5 status keys regardless of which are present", async () => {
      await createOrder({ status: "CANCELLED" });

      const summary = await reportService.getOrdersSummary(companyId);

      expect(Object.keys(summary)).toHaveLength(5);
      expect(summary.CANCELLED).toBe(1);
      expect(summary.PENDING).toBe(0);
    });
  });
});
