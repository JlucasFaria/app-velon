import { describe, it, expect, beforeEach, beforeAll } from "bun:test";
import { ReceiptService } from "../receipt-service";
import prisma from "../../../db/client";

const receiptService = new ReceiptService();

let testUserId: number;
let testClientId: number;
let testOrderId: number;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: "receipt-svc-test@example.com",
      password: "hashed",
      name: "Receipt Test User",
    },
  });
  testUserId = user.id;

  const client = await prisma.client.create({
    data: {
      name: "Receipt Test Client",
      document: "receipt-svc-doc-unique",
      clientType: "COUNTER",
    },
  });
  testClientId = client.id;
});

beforeEach(async () => {
  await prisma.receipt.deleteMany();
  await prisma.serviceOrder.deleteMany();

  const order = await prisma.serviceOrder.create({
    data: {
      orderNumber: "OS-RCPT-01",
      description: "Screen replacement",
      value: "250.00",
      clientId: testClientId,
      statusHistory: {
        create: { toStatus: "PENDING", changedById: testUserId },
      },
    },
  });
  testOrderId = order.id;
});

describe("ReceiptService", () => {
  describe("generate", () => {
    it("should create a receipt for an order", async () => {
      const receipt = await receiptService.generate(testOrderId);

      expect(receipt).not.toBeNull();
      expect(receipt.id).toBeDefined();
      expect(receipt.receiptNumber).toBeDefined();
      expect(receipt.issuedAt).toBeDefined();
    });

    it("should embed order with description, value and client", async () => {
      const receipt = await receiptService.generate(testOrderId);

      expect(receipt.order.id).toBe(testOrderId);
      expect(receipt.order.description).toBe("Screen replacement");
      expect(receipt.order.value.toString()).toBe("250");
      expect(receipt.order.client.id).toBe(testClientId);
      expect(receipt.order.client.name).toBe("Receipt Test Client");
      expect(receipt.order.client.document).toBe("receipt-svc-doc-unique");
    });

    it("should return the same receipt on a second call (idempotent)", async () => {
      const first = await receiptService.generate(testOrderId);
      const second = await receiptService.generate(testOrderId);

      expect(first.id).toBe(second.id);
      expect(first.receiptNumber).toBe(second.receiptNumber);
    });

    it("should not create a duplicate receipt in the database", async () => {
      await receiptService.generate(testOrderId);
      await receiptService.generate(testOrderId);

      const count = await prisma.receipt.count({
        where: { orderId: testOrderId },
      });

      expect(count).toBe(1);
    });
  });

  describe("getByOrderId", () => {
    it("should return the receipt after it has been generated", async () => {
      await receiptService.generate(testOrderId);
      const receipt = await receiptService.getByOrderId(testOrderId);

      expect(receipt).not.toBeNull();
      expect(receipt!.order.id).toBe(testOrderId);
    });

    it("should return null when no receipt exists for the order", async () => {
      const receipt = await receiptService.getByOrderId(testOrderId);

      expect(receipt).toBeNull();
    });
  });

  describe("orderExists", () => {
    it("should return true for an existing order", async () => {
      expect(await receiptService.orderExists(testOrderId)).toBe(true);
    });

    it("should return false for a non-existent order", async () => {
      expect(await receiptService.orderExists(999999)).toBe(false);
    });
  });
});
