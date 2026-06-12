import { describe, it, expect, beforeEach, beforeAll } from "bun:test";
import { OrderService } from "../order-service";
import prisma from "../../../db/client";
import { createTestCompany } from "../../../test-utils/company";

const orderService = new OrderService();

let testUserId: number;
let testClientId: number;
let companyId: number;

const baseOrder = () => ({
  description: "Screen replacement",
  items: [
    { description: "Screen replacement", unitValue: "250.00", quantity: 1 },
  ],
  clientId: testClientId,
});

// Upsert the user (no per-company scope) so the suite stays idempotent; the
// company + client are created fresh under a dedicated company for this file.
beforeAll(async () => {
  companyId = await createTestCompany("Order Service Company");

  const user = await prisma.user.upsert({
    where: { email: "order-svc-test@example.com" },
    update: {},
    create: {
      email: "order-svc-test@example.com",
      password: "hashed",
      name: "Test User",
    },
  });
  testUserId = user.id;

  // Active membership so the user is assignable to orders in this company.
  await prisma.membership.upsert({
    where: { userId_companyId: { userId: user.id, companyId } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { userId: user.id, companyId, role: "ADMIN", status: "ACTIVE" },
  });

  const client = await prisma.client.create({
    data: {
      name: "Test Client",
      document: "order-svc-doc-unique",
      clientType: "COUNTER",
      companyId,
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
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );

      expect(order).toHaveProperty("id");
      expect(order.description).toBe("Screen replacement");
      expect(order.clientId).toBe(testClientId);
      expect(order.status).toBe("PENDING");
      expect(order.assignedUserId).toBeNull();
    });

    it("should generate orderNumber as OS-0001 for the first order", async () => {
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );

      expect(order.orderNumber).toBe("OS-0001");
    });

    it("should increment orderNumber sequentially", async () => {
      const first = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );
      const second = await orderService.create(
        { ...baseOrder(), description: "Battery replacement" },
        testUserId,
        companyId,
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
          companyId,
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
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );

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
        companyId,
      );

      expect(order.assignedUserId).toBe(testUserId);
    });
  });

  describe("getAll", () => {
    it("should return all orders with pagination metadata", async () => {
      await orderService.create(baseOrder(), testUserId, companyId);
      await orderService.create(
        { ...baseOrder(), description: "Battery replacement" },
        testUserId,
        companyId,
      );

      const result = await orderService.getAll(companyId);

      expect(result.orders.length).toBe(2);
      expect(result.pagination.total).toBe(2);
    });

    it("should filter by status", async () => {
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );
      await orderService.create(
        { ...baseOrder(), description: "Another order" },
        testUserId,
        companyId,
      );
      await orderService.updateStatus(
        order.id,
        { status: "IN_PROGRESS" },
        testUserId,
        companyId,
      );

      const result = await orderService.getAll(
        companyId,
        undefined,
        undefined,
        "IN_PROGRESS",
      );

      expect(result.orders.length).toBe(1);
      expect(result.orders[0]?.status).toBe("IN_PROGRESS");
    });

    it("should search by orderNumber (case-insensitive)", async () => {
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );
      await orderService.create(
        { ...baseOrder(), description: "Other" },
        testUserId,
        companyId,
      );

      const result = await orderService.getAll(
        companyId,
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
      await orderService.create(baseOrder(), testUserId, companyId);

      const result = await orderService.getAll(
        companyId,
        undefined,
        undefined,
        undefined,
        undefined,
        "test client",
      );

      expect(result.orders.length).toBe(1);
    });

    it("should return correct pagination metadata", async () => {
      await orderService.create(baseOrder(), testUserId, companyId);
      await orderService.create(
        { ...baseOrder(), description: "Second" },
        testUserId,
        companyId,
      );

      const result = await orderService.getAll(companyId, "1", "1");

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it("should not return orders from another company", async () => {
      await orderService.create(baseOrder(), testUserId, companyId);
      const otherCompanyId = await createTestCompany("Other Orders Company");
      const otherClient = await prisma.client.create({
        data: {
          name: "Other Client",
          document: "order-svc-other-doc",
          clientType: "COUNTER",
          companyId: otherCompanyId,
        },
      });
      await orderService.create(
        { ...baseOrder(), clientId: otherClient.id },
        testUserId,
        otherCompanyId,
      );

      const result = await orderService.getAll(companyId);

      expect(result.orders.length).toBe(1);
    });
  });

  describe("findById", () => {
    it("should return an order with client and statusHistory", async () => {
      const created = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );
      const found = await orderService.findById(created.id, companyId);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.client).toBeDefined();
      expect(found?.client.id).toBe(testClientId);
      expect(Array.isArray(found?.statusHistory)).toBe(true);
      expect(found?.statusHistory.length).toBe(1);
    });

    it("should return null for a non-existent id", async () => {
      const found = await orderService.findById(999999, companyId);

      expect(found).toBeNull();
    });

    it("should return null for an order owned by another company", async () => {
      const created = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );
      const otherCompanyId = await createTestCompany("Other Find Company");

      const found = await orderService.findById(created.id, otherCompanyId);

      expect(found).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("should update the order status", async () => {
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );
      const updated = await orderService.updateStatus(
        order.id,
        { status: "IN_PROGRESS" },
        testUserId,
        companyId,
      );

      expect(updated?.status).toBe("IN_PROGRESS");
    });

    it("should record a StatusHistory entry with correct fields", async () => {
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );
      await orderService.updateStatus(
        order.id,
        { status: "IN_PROGRESS", note: "Part arrived" },
        testUserId,
        companyId,
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
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );
      const updated = await orderService.updateStatus(
        order.id,
        { status: "COMPLETED" },
        testUserId,
        companyId,
      );

      expect(Array.isArray(updated?.statusHistory)).toBe(true);
      expect(updated?.statusHistory.length).toBe(2);
      expect(updated?.client).toBeDefined();
    });

    it("should record changedBy user info in the returned detail", async () => {
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );
      const updated = await orderService.updateStatus(
        order.id,
        { status: "IN_PROGRESS" },
        testUserId,
        companyId,
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
        companyId,
      );

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update editable order fields", async () => {
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );
      const updated = await orderService.update(order.id, companyId, {
        description: "Battery replacement",
        items: [{ description: "Bateria", unitValue: "180.00", quantity: 1 }],
      });

      expect(updated?.description).toBe("Battery replacement");
      expect(updated?.value.toString()).toBe("180");
      expect(updated?.orderNumber).toBe(order.orderNumber);
    });

    it("should set assignedUserId to null when explicitly passed", async () => {
      const order = await orderService.create(
        { ...baseOrder(), assignedUserId: testUserId },
        testUserId,
        companyId,
      );
      const updated = await orderService.update(order.id, companyId, {
        assignedUserId: null,
      });

      expect(updated?.assignedUserId).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete an order", async () => {
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );
      await orderService.delete(order.id, companyId);

      const found = await orderService.findById(order.id, companyId);
      expect(found).toBeNull();
    });
  });

  describe("items and total computation", () => {
    it("should persist items and compute the correct total", async () => {
      const order = await orderService.create(
        {
          description: "Multi-item service",
          items: [{ description: "Part A", unitValue: "150.00", quantity: 2 }],
          clientId: testClientId,
        },
        testUserId,
        companyId,
      );

      expect(order.value.toString()).toBe("300");
      expect(order.items).toHaveLength(1);
      expect(order.items[0]?.description).toBe("Part A");
      expect(order.items[0]?.quantity).toBe(2);
      expect(order.items[0]?.subtotal.toString()).toBe("300");
    });

    it("should sum multiple items into the total", async () => {
      const order = await orderService.create(
        {
          description: "Combo service",
          items: [
            { description: "Part A", unitValue: "100.00", quantity: 1 },
            { description: "Part B", unitValue: "50.00", quantity: 3 },
          ],
          clientId: testClientId,
        },
        testUserId,
        companyId,
      );

      // 100 + (50 × 3) = 250
      expect(order.value.toString()).toBe("250");
      expect(order.items).toHaveLength(2);
      expect(order.items[0]?.subtotal.toString()).toBe("100");
      expect(order.items[1]?.subtotal.toString()).toBe("150");
    });

    it("should avoid floating-point drift when summing items", async () => {
      const order = await orderService.create(
        {
          description: "Float edge case",
          items: [
            { description: "A", unitValue: "0.10", quantity: 1 },
            { description: "B", unitValue: "0.20", quantity: 1 },
          ],
          clientId: testClientId,
        },
        testUserId,
        companyId,
      );

      // 0.1 + 0.2 = 0.30 (not 0.30000000000000004 via floating-point drift)
      expect(order.value.toString()).toBe("0.3");
    });

    it("should include optional category on each item", async () => {
      const order = await orderService.create(
        {
          description: "Categorised service",
          items: [
            {
              description: "Mão de obra",
              category: "Honorário",
              unitValue: "200.00",
              quantity: 1,
            },
          ],
          clientId: testClientId,
        },
        testUserId,
        companyId,
      );

      expect(order.items[0]?.category).toBe("Honorário");
    });

    it("should return items ordered by id (insertion order)", async () => {
      const order = await orderService.create(
        {
          description: "Ordered items",
          items: [
            { description: "First", unitValue: "10.00", quantity: 1 },
            { description: "Second", unitValue: "20.00", quantity: 1 },
            { description: "Third", unitValue: "30.00", quantity: 1 },
          ],
          clientId: testClientId,
        },
        testUserId,
        companyId,
      );

      expect(order.items[0]?.description).toBe("First");
      expect(order.items[1]?.description).toBe("Second");
      expect(order.items[2]?.description).toBe("Third");
    });

    it("should replace all items and recompute total on update", async () => {
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );

      const updated = await orderService.update(order.id, companyId, {
        items: [{ description: "New item", unitValue: "75.00", quantity: 4 }],
      });

      // 75 × 4 = 300; old item (250) must be gone
      expect(updated?.value.toString()).toBe("300");
      expect(updated?.items).toHaveLength(1);
      expect(updated?.items[0]?.description).toBe("New item");
    });

    it("should not change items when update omits the items field", async () => {
      const order = await orderService.create(
        baseOrder(),
        testUserId,
        companyId,
      );

      const updated = await orderService.update(order.id, companyId, {
        description: "Updated description only",
      });

      // Total unchanged; items preserved
      expect(updated?.value.toString()).toBe("250");
      expect(updated?.items).toHaveLength(1);
      expect(updated?.description).toBe("Updated description only");
    });

    it("should reject a total that exceeds the Decimal(10,2) ceiling", async () => {
      // Two items each near the column ceiling overflow the order total —
      // the service must reject this as a clean error, not let it hit the DB.
      await expect(
        orderService.create(
          {
            description: "Overflow order",
            items: [
              { description: "A", unitValue: "99999999.99", quantity: 1 },
              { description: "B", unitValue: "99999999.99", quantity: 1 },
            ],
            clientId: testClientId,
          },
          testUserId,
          companyId,
        ),
      ).rejects.toThrow();
    });
  });

  describe("legacy migration", () => {
    it("should create one Serviço item for a bare order (no items)", async () => {
      // Insert a ServiceOrder directly, bypassing the service — simulates
      // pre-migration rows that had a value but no OrderItems.
      const legacyOrder = await prisma.serviceOrder.create({
        data: {
          orderNumber: `OS-LEGACY-${crypto.randomUUID()}`,
          description: "Legacy order",
          value: "99.99",
          clientId: testClientId,
          companyId,
          statusHistory: {
            create: { toStatus: "PENDING", changedById: testUserId },
          },
        },
      });

      // Run the migration SQL scoped to this order
      await prisma.$executeRaw`
        INSERT INTO "OrderItem" ("orderId","description","category","unitValue","quantity","subtotal","createdAt","updatedAt")
        SELECT o."id",'Serviço',NULL,o."value",1,o."value",NOW(),NOW()
        FROM "ServiceOrder" o
        WHERE NOT EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o."id")
          AND o."id" = ${legacyOrder.id}
      `;

      const items = await prisma.orderItem.findMany({
        where: { orderId: legacyOrder.id },
      });

      expect(items).toHaveLength(1);
      expect(items[0]?.description).toBe("Serviço");
      expect(items[0]?.quantity).toBe(1);
      expect(items[0]?.unitValue.toString()).toBe("99.99");
    });

    it("should be idempotent — running migration twice does not duplicate items", async () => {
      const legacyOrder = await prisma.serviceOrder.create({
        data: {
          orderNumber: `OS-LEGACY-${crypto.randomUUID()}`,
          description: "Idempotent test",
          value: "50.00",
          clientId: testClientId,
          companyId,
          statusHistory: {
            create: { toStatus: "PENDING", changedById: testUserId },
          },
        },
      });

      const migrationSql = async () => {
        await prisma.$executeRaw`
          INSERT INTO "OrderItem" ("orderId","description","category","unitValue","quantity","subtotal","createdAt","updatedAt")
          SELECT o."id",'Serviço',NULL,o."value",1,o."value",NOW(),NOW()
          FROM "ServiceOrder" o
          WHERE NOT EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o."id")
            AND o."id" = ${legacyOrder.id}
        `;
      };

      await migrationSql();
      await migrationSql();

      const items = await prisma.orderItem.findMany({
        where: { orderId: legacyOrder.id },
      });
      expect(items).toHaveLength(1);
    });
  });

  describe("clientExists", () => {
    it("should return true for an existing client", async () => {
      expect(await orderService.clientExists(testClientId, companyId)).toBe(
        true,
      );
    });

    it("should return false for a non-existent client", async () => {
      expect(await orderService.clientExists(999999, companyId)).toBe(false);
    });

    it("should return false for a client in another company", async () => {
      const otherCompanyId = await createTestCompany("Other Exists Company");
      expect(
        await orderService.clientExists(testClientId, otherCompanyId),
      ).toBe(false);
    });
  });

  describe("userExists", () => {
    it("should return true for an active member of the company", async () => {
      expect(await orderService.userExists(testUserId, companyId)).toBe(true);
    });

    it("should return false for a non-existent user", async () => {
      expect(await orderService.userExists(999999, companyId)).toBe(false);
    });

    it("should return false for a user who is not a member of the company", async () => {
      const otherCompanyId = await createTestCompany("Other Member Company");
      expect(await orderService.userExists(testUserId, otherCompanyId)).toBe(
        false,
      );
    });
  });
});
