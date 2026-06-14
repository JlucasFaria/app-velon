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

// Extended helper that supports items, paymentStatus, and a custom createdAt.
const createOrderFull = async (
  overrides: Partial<{
    status:
      | "PENDING"
      | "IN_PROGRESS"
      | "AWAITING_CLIENT"
      | "COMPLETED"
      | "CANCELLED";
    value: string;
    completedAt: Date;
    paymentStatus:
      | "UNPAID"
      | "PAID_PIX"
      | "PAID_CREDIT"
      | "PAID_DEBIT"
      | "PAID_CASH"
      | "PAID_TRANSFER"
      | "PAID_OTHER";
    items: Array<{
      description: string;
      category?: string | null;
      unitValue: string;
      quantity: number;
      subtotal: string;
    }>;
    createdAt: Date;
    clientId: number;
  }> = {},
) => {
  const seq = await prisma.serviceOrder.count();
  const status = overrides.status ?? "PENDING";
  const value = overrides.value ?? "100.00";
  const completedAt = overrides.completedAt ?? JUNE_2026;
  return prisma.serviceOrder.create({
    data: {
      orderNumber: `OS-RPTF-${String(seq + 1).padStart(3, "0")}`,
      description: "Test service",
      value,
      clientId: overrides.clientId ?? testClientId,
      companyId,
      status,
      paymentStatus: overrides.paymentStatus ?? "UNPAID",
      ...(overrides.createdAt && { createdAt: overrides.createdAt }),
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

describe("ReportService", () => {
  describe("getMonthlyBilling", () => {
    it("should return empty result when no COMPLETED orders exist for the month", async () => {
      const result = await reportService.getMonthlyBilling(companyId, 6, 2026);

      expect(result.month).toBe(6);
      expect(result.year).toBe(2026);
      expect(result.orderCount).toBe(0);
      expect(result.totalRevenue).toBe("0.00");
      expect(result.totalHonorario).toBe("0.00");
      expect(result.orders).toHaveLength(0);
    });

    it("should aggregate honorário per order and in totalHonorario", async () => {
      await createOrderFull({
        status: "COMPLETED",
        completedAt: JUNE_2026,
        value: "250.00",
        items: [
          {
            description: "Honorário",
            category: "Honorário",
            unitValue: "100.00",
            quantity: 1,
            subtotal: "100.00",
          },
          {
            description: "Peça",
            category: "Peças",
            unitValue: "150.00",
            quantity: 1,
            subtotal: "150.00",
          },
        ],
      });
      await createOrderFull({
        status: "COMPLETED",
        completedAt: JUNE_2026,
        value: "80.00",
        items: [
          {
            description: "Honorário",
            category: "honorário",
            unitValue: "80.00",
            quantity: 1,
            subtotal: "80.00",
          },
        ],
      });

      const result = await reportService.getMonthlyBilling(companyId, 6, 2026);

      expect(result.orderCount).toBe(2);
      expect(result.totalRevenue).toBe("330.00");
      expect(result.totalHonorario).toBe("180.00");
      const honorarios = result.orders.map((o) => o.honorario);
      expect(honorarios).toContain("100.00");
      expect(honorarios).toContain("80.00");
    });

    it("should return honorário 0.00 for an order without Honorário items", async () => {
      await createOrderFull({
        status: "COMPLETED",
        completedAt: JUNE_2026,
        value: "100.00",
        items: [
          {
            description: "Peça",
            category: "Peças",
            unitValue: "100.00",
            quantity: 1,
            subtotal: "100.00",
          },
        ],
      });

      const result = await reportService.getMonthlyBilling(companyId, 6, 2026);

      expect(result.totalHonorario).toBe("0.00");
      expect(result.orders[0]!.honorario).toBe("0.00");
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
      expect(order.client.clientType).toBe("COUNTER");
      expect(order.client.partnerName).toBeNull();
    });

    it("should expose clientType and partnerName for a PARTNER client", async () => {
      const partnerEntity = await prisma.partner.create({
        data: { name: "Billing Partner", companyId },
      });
      const partnerClient = await prisma.client.create({
        data: {
          name: "Billing Partner Co",
          document: `billing-partner-doc-${crypto.randomUUID()}`,
          clientType: "PARTNER",
          partnerId: partnerEntity.id,
          companyId,
        },
      });
      await prisma.serviceOrder.create({
        data: {
          orderNumber: `OS-RPT-PB-${crypto.randomUUID().slice(0, 8)}`,
          description: "Partner billing order",
          value: "300.00",
          clientId: partnerClient.id,
          companyId,
          status: "COMPLETED",
          statusHistory: {
            create: [
              { toStatus: "PENDING", changedById: testUserId },
              {
                fromStatus: "PENDING",
                toStatus: "COMPLETED",
                changedById: testUserId,
                changedAt: JUNE_2026,
              },
            ],
          },
        },
      });

      const result = await reportService.getMonthlyBilling(companyId, 6, 2026);
      const order = result.orders.find((o) => o.client.id === partnerClient.id);

      expect(order).toBeDefined();
      expect(order!.client.clientType).toBe("PARTNER");
      expect(order!.client.partnerName).toBe("Billing Partner");
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

  describe("getAllOrders", () => {
    it("should return empty result when no orders exist", async () => {
      const result = await reportService.getAllOrders(companyId, {});

      expect(result.orders).toHaveLength(0);
      expect(result.totals.sumTotal).toBe("0.00");
      expect(result.totals.sumHonorario).toBe("0.00");
      expect(result.totals.totalReceived).toBe("0.00");
    });

    it("should return all company orders with no filters", async () => {
      await createOrderFull({ value: "100.00" });
      await createOrderFull({ value: "200.00" });

      const result = await reportService.getAllOrders(companyId, {});

      expect(result.orders).toHaveLength(2);
    });

    it("should expose clientType and a null partnerName for a COUNTER client", async () => {
      await createOrderFull({ clientId: testClientId });

      const result = await reportService.getAllOrders(companyId, {});

      expect(result.orders[0]!.client.clientType).toBe("COUNTER");
      expect(result.orders[0]!.client.partnerName).toBeNull();
    });

    it("should scope orders to the requesting company", async () => {
      await createOrderFull({ value: "100.00" });

      const otherCompanyId = await createTestCompany("Scoping Other Company");
      const otherClient = await prisma.client.create({
        data: {
          name: "Scoping Other Client",
          document: `scope-doc-${crypto.randomUUID()}`,
          clientType: "COUNTER",
          companyId: otherCompanyId,
        },
      });
      await prisma.serviceOrder.create({
        data: {
          orderNumber: "OS-SCOPE-001",
          description: "Other co order",
          value: "999.00",
          clientId: otherClient.id,
          companyId: otherCompanyId,
          status: "PENDING",
          items: {
            create: [
              {
                description: "Item",
                unitValue: "999.00",
                quantity: 1,
                subtotal: "999.00",
              },
            ],
          },
          statusHistory: {
            create: [{ toStatus: "PENDING", changedById: testUserId }],
          },
        },
      });

      const result = await reportService.getAllOrders(companyId, {});

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0]!.total).toBe("100.00");
    });

    it("should filter by status", async () => {
      await createOrderFull({ status: "PENDING" });
      await createOrderFull({ status: "COMPLETED" });
      await createOrderFull({ status: "CANCELLED" });

      const result = await reportService.getAllOrders(companyId, {
        status: "PENDING",
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0]!.status).toBe("PENDING");
    });

    it("should filter by partnerName (case-insensitive, via the client relation)", async () => {
      const partnerEntity = await prisma.partner.create({
        data: { name: "Alpha Partner", companyId },
      });
      const partnerClient = await prisma.client.create({
        data: {
          name: "Partner Co",
          document: `partner-doc-${crypto.randomUUID()}`,
          clientType: "PARTNER",
          partnerId: partnerEntity.id,
          companyId,
        },
      });

      await createOrderFull({ clientId: testClientId }); // COUNTER, no partner
      await createOrderFull({ clientId: partnerClient.id });

      const result = await reportService.getAllOrders(companyId, {
        partnerName: "alpha",
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0]!.client.id).toBe(partnerClient.id);
      expect(result.orders[0]!.client.clientType).toBe("PARTNER");
      expect(result.orders[0]!.client.partnerName).toBe("Alpha Partner");
    });

    it("should filter by dateFrom", async () => {
      await createOrderFull({ createdAt: new Date("2026-01-15T12:00:00Z") });
      await createOrderFull({ createdAt: new Date("2026-06-15T12:00:00Z") });

      const result = await reportService.getAllOrders(companyId, {
        dateFrom: "2026-06-01",
      });

      expect(result.orders).toHaveLength(1);
    });

    it("should filter by dateTo", async () => {
      await createOrderFull({ createdAt: new Date("2026-01-15T12:00:00Z") });
      await createOrderFull({ createdAt: new Date("2026-06-15T12:00:00Z") });

      const result = await reportService.getAllOrders(companyId, {
        dateTo: "2026-03-31",
      });

      expect(result.orders).toHaveLength(1);
    });

    it("should filter by dateFrom + dateTo range", async () => {
      await createOrderFull({ createdAt: new Date("2026-01-15T12:00:00Z") });
      await createOrderFull({ createdAt: new Date("2026-04-10T12:00:00Z") });
      await createOrderFull({ createdAt: new Date("2026-06-15T12:00:00Z") });

      const result = await reportService.getAllOrders(companyId, {
        dateFrom: "2026-03-01",
        dateTo: "2026-05-31",
      });

      expect(result.orders).toHaveLength(1);
    });

    it("should aggregate honorário from items with category Honorário", async () => {
      await createOrderFull({
        value: "250.00",
        items: [
          {
            description: "Honorário",
            category: "Honorário",
            unitValue: "100.00",
            quantity: 1,
            subtotal: "100.00",
          },
          {
            description: "Peça",
            category: "Peças",
            unitValue: "50.00",
            quantity: 3,
            subtotal: "150.00",
          },
        ],
      });

      const result = await reportService.getAllOrders(companyId, {});

      expect(result.orders[0]!.honorario).toBe("100.00");
    });

    it("should aggregate honorário case-insensitively", async () => {
      await createOrderFull({
        value: "200.00",
        items: [
          {
            description: "H lowercase",
            category: "honorário",
            unitValue: "80.00",
            quantity: 1,
            subtotal: "80.00",
          },
          {
            description: "H uppercase",
            category: "HONORÁRIO",
            unitValue: "70.00",
            quantity: 1,
            subtotal: "70.00",
          },
        ],
      });

      const result = await reportService.getAllOrders(companyId, {});

      expect(result.orders[0]!.honorario).toBe("150.00");
    });

    it("should return honorário 0.00 when no items match the category", async () => {
      await createOrderFull({
        value: "100.00",
        items: [
          {
            description: "Peça",
            category: "Peças",
            unitValue: "100.00",
            quantity: 1,
            subtotal: "100.00",
          },
        ],
      });

      const result = await reportService.getAllOrders(companyId, {});

      expect(result.orders[0]!.honorario).toBe("0.00");
    });

    it("should compute footer totals correctly", async () => {
      await createOrderFull({
        value: "100.00",
        paymentStatus: "PAID_PIX",
        items: [
          {
            description: "Honorário",
            category: "Honorário",
            unitValue: "100.00",
            quantity: 1,
            subtotal: "100.00",
          },
        ],
      });
      await createOrderFull({
        value: "200.00",
        paymentStatus: "UNPAID",
        items: [
          {
            description: "Peças",
            category: null,
            unitValue: "200.00",
            quantity: 1,
            subtotal: "200.00",
          },
        ],
      });

      const result = await reportService.getAllOrders(companyId, {});

      expect(result.totals.sumTotal).toBe("300.00");
      expect(result.totals.sumHonorario).toBe("100.00");
      // Only the PAID_PIX order counts as received
      expect(result.totals.totalReceived).toBe("100.00");
    });

    it("should include all paid statuses in totalReceived", async () => {
      await createOrderFull({ value: "100.00", paymentStatus: "PAID_PIX" });
      await createOrderFull({ value: "200.00", paymentStatus: "PAID_CASH" });
      await createOrderFull({ value: "300.00", paymentStatus: "UNPAID" });

      const result = await reportService.getAllOrders(companyId, {});

      expect(result.totals.totalReceived).toBe("300.00");
    });

    it("should set completedAt from status history for completed orders", async () => {
      const completedDate = new Date("2026-06-10T10:00:00.000Z");
      await createOrderFull({
        status: "COMPLETED",
        completedAt: completedDate,
      });

      const result = await reportService.getAllOrders(companyId, {});

      expect(result.orders[0]!.completedAt).toBe(completedDate.toISOString());
    });

    it("should return null completedAt for non-completed orders", async () => {
      await createOrderFull({ status: "PENDING" });

      const result = await reportService.getAllOrders(companyId, {});

      expect(result.orders[0]!.completedAt).toBeNull();
    });

    it("should include order fields in each row", async () => {
      await createOrderFull({ value: "150.00" });

      const result = await reportService.getAllOrders(companyId, {});
      const row = result.orders[0]!;

      expect(row.orderNumber).toMatch(/^OS-/);
      expect(row.client.id).toBe(testClientId);
      expect(row.client.name).toBe("Report Test Client");
      expect(row.total).toBe("150.00");
      expect(row.status).toBe("PENDING");
      expect(row.paymentStatus).toBe("UNPAID");
      expect(row.createdAt).toBeDefined();
    });
  });
});
