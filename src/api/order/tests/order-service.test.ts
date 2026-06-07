import { describe, it, expect, beforeEach, beforeAll } from "bun:test";
import { OrderService } from "../order-service";
import prisma from "../../../db/client";

const orderService = new OrderService();

let testUserId: number;
let testClientId: number;

const baseOrder = () => ({
  description: "Screen replacement",
  value: "250.00",
  clientId: testClientId,
});

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: "order-svc-test@example.com",
      password: "hashed",
      name: "Test User",
    },
  });
  testUserId = user.id;

  const client = await prisma.client.create({
    data: {
      name: "Test Client",
      document: "order-svc-doc-unique",
      clientType: "COUNTER",
    },
  });
  testClientId = client.id;
});

beforeEach(async () => {
  await prisma.serviceOrder.deleteMany();
});

describe("OrderService", () => {
  describe("create", () => {
    it("should create an order and return it with base fields", async () => {
      const order = await orderService.create(baseOrder(), testUserId);

      expect(order).toHaveProperty("id");
      expect(order.description).toBe("Screen replacement");
      expect(order.clientId).toBe(testClientId);
      expect(order.status).toBe("PENDING");
      expect(order.assignedUserId).toBeNull();
    });

    it("should generate orderNumber as OS-0001 for the first order", async () => {
      const order = await orderService.create(baseOrder(), testUserId);

      expect(order.orderNumber).toBe("OS-0001");
    });

    it("should increment orderNumber sequentially", async () => {
      const first = await orderService.create(baseOrder(), testUserId);
      const second = await orderService.create(
        { ...baseOrder(), description: "Battery replacement" },
        testUserId,
      );

      expect(first.orderNumber).toBe("OS-0001");
      expect(second.orderNumber).toBe("OS-0002");
    });

    it("should zero-pad orderNumber to 4 digits", async () => {
      // Create 9 orders and check the 9th is OS-0009 (padded)
      for (let i = 0; i < 9; i++) {
        await orderService.create(
          { ...baseOrder(), description: `Order ${i}` },
          testUserId,
        );
      }
      const orders = await prisma.serviceOrder.findMany({
        orderBy: { id: "asc" },
        select: { orderNumber: true },
      });

      expect(orders[0]?.orderNumber).toBe("OS-0001");
      expect(orders[8]?.orderNumber).toBe("OS-0009");
    });

    it("should record the initial PENDING status in StatusHistory", async () => {
      const order = await orderService.create(baseOrder(), testUserId);

      const history = await prisma.statusHistory.findMany({
        where: { orderId: order.id },
      });

      expect(history).toHaveLength(1);
      expect(history[0]?.toStatus).toBe("PENDING");
      expect(history[0]?.fromStatus).toBeNull();
      expect(history[0]?.changedById).toBe(testUserId);
    });

    it("should accept an optional assignedUserId", async () => {
      const order = await orderService.create(
        { ...baseOrder(), assignedUserId: testUserId },
        testUserId,
      );

      expect(order.assignedUserId).toBe(testUserId);
    });
  });

  describe("getAll", () => {
    it("should return all orders with pagination metadata", async () => {
      await orderService.create(baseOrder(), testUserId);
      await orderService.create(
        { ...baseOrder(), description: "Battery replacement" },
        testUserId,
      );

      const result = await orderService.getAll();

      expect(result.orders.length).toBe(2);
      expect(result.pagination.total).toBe(2);
    });

    it("should filter by status", async () => {
      const order = await orderService.create(baseOrder(), testUserId);
      await orderService.create(
        { ...baseOrder(), description: "Another order" },
        testUserId,
      );
      await orderService.updateStatus(
        order.id,
        { status: "IN_PROGRESS" },
        testUserId,
      );

      const result = await orderService.getAll(
        undefined,
        undefined,
        "IN_PROGRESS",
      );

      expect(result.orders.length).toBe(1);
      expect(result.orders[0]?.status).toBe("IN_PROGRESS");
    });

    it("should search by orderNumber (case-insensitive)", async () => {
      const order = await orderService.create(baseOrder(), testUserId);
      await orderService.create(
        { ...baseOrder(), description: "Other" },
        testUserId,
      );

      const result = await orderService.getAll(
        undefined,
        undefined,
        undefined,
        undefined,
        order.orderNumber.toLowerCase(),
      );

      expect(result.orders.length).toBe(1);
      expect(result.orders[0]?.orderNumber).toBe(order.orderNumber);
    });

    it("should search by client name (case-insensitive)", async () => {
      await orderService.create(baseOrder(), testUserId);

      const result = await orderService.getAll(
        undefined,
        undefined,
        undefined,
        undefined,
        "test client",
      );

      expect(result.orders.length).toBe(1);
    });

    it("should return correct pagination metadata", async () => {
      await orderService.create(baseOrder(), testUserId);
      await orderService.create(
        { ...baseOrder(), description: "Second" },
        testUserId,
      );

      const result = await orderService.getAll("1", "1");

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });
  });

  describe("findById", () => {
    it("should return an order with client and statusHistory", async () => {
      const created = await orderService.create(baseOrder(), testUserId);
      const found = await orderService.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.client).toBeDefined();
      expect(found?.client.id).toBe(testClientId);
      expect(Array.isArray(found?.statusHistory)).toBe(true);
      expect(found?.statusHistory.length).toBe(1);
    });

    it("should return null for a non-existent id", async () => {
      const found = await orderService.findById(999999);

      expect(found).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("should update the order status", async () => {
      const order = await orderService.create(baseOrder(), testUserId);
      const updated = await orderService.updateStatus(
        order.id,
        { status: "IN_PROGRESS" },
        testUserId,
      );

      expect(updated?.status).toBe("IN_PROGRESS");
    });

    it("should record a StatusHistory entry with correct fields", async () => {
      const order = await orderService.create(baseOrder(), testUserId);
      await orderService.updateStatus(
        order.id,
        { status: "IN_PROGRESS", note: "Part arrived" },
        testUserId,
      );

      const history = await prisma.statusHistory.findMany({
        where: { orderId: order.id },
        orderBy: { changedAt: "asc" },
      });

      // First entry: creation (PENDING), second: our status change
      expect(history).toHaveLength(2);

      const change = history[1]!;
      expect(change.fromStatus).toBe("PENDING");
      expect(change.toStatus).toBe("IN_PROGRESS");
      expect(change.changedById).toBe(testUserId);
      expect(change.note).toBe("Part arrived");
    });

    it("should return order with embedded statusHistory after update", async () => {
      const order = await orderService.create(baseOrder(), testUserId);
      const updated = await orderService.updateStatus(
        order.id,
        { status: "COMPLETED" },
        testUserId,
      );

      expect(Array.isArray(updated?.statusHistory)).toBe(true);
      expect(updated?.statusHistory.length).toBe(2);
      expect(updated?.client).toBeDefined();
    });

    it("should record changedBy user info in the returned detail", async () => {
      const order = await orderService.create(baseOrder(), testUserId);
      const updated = await orderService.updateStatus(
        order.id,
        { status: "IN_PROGRESS" },
        testUserId,
      );

      const lastEntry =
        updated?.statusHistory[updated.statusHistory.length - 1];
      expect(lastEntry?.changedBy.id).toBe(testUserId);
      expect(lastEntry?.changedBy.email).toBe("order-svc-test@example.com");
    });

    it("should return null for a non-existent order", async () => {
      const result = await orderService.updateStatus(
        999999,
        { status: "IN_PROGRESS" },
        testUserId,
      );

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update editable order fields", async () => {
      const order = await orderService.create(baseOrder(), testUserId);
      const updated = await orderService.update(order.id, {
        description: "Battery replacement",
        value: "180.00",
      });

      expect(updated.description).toBe("Battery replacement");
      expect(updated.value.toString()).toBe("180");
      expect(updated.orderNumber).toBe(order.orderNumber);
    });

    it("should set assignedUserId to null when explicitly passed", async () => {
      const order = await orderService.create(
        { ...baseOrder(), assignedUserId: testUserId },
        testUserId,
      );
      const updated = await orderService.update(order.id, {
        assignedUserId: null,
      });

      expect(updated.assignedUserId).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete an order", async () => {
      const order = await orderService.create(baseOrder(), testUserId);
      await orderService.delete(order.id);

      const found = await orderService.findById(order.id);
      expect(found).toBeNull();
    });
  });

  describe("clientExists", () => {
    it("should return true for an existing client", async () => {
      expect(await orderService.clientExists(testClientId)).toBe(true);
    });

    it("should return false for a non-existent client", async () => {
      expect(await orderService.clientExists(999999)).toBe(false);
    });
  });

  describe("userExists", () => {
    it("should return true for an existing user", async () => {
      expect(await orderService.userExists(testUserId)).toBe(true);
    });

    it("should return false for a non-existent user", async () => {
      expect(await orderService.userExists(999999)).toBe(false);
    });
  });
});
