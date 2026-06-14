import { describe, it, expect, beforeEach } from "bun:test";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import { signTestToken, createTestCompany } from "../../../test-utils/company";

describe("Order Routes", () => {
  let token: string;
  let testUserId: number;
  let testClientId: number;
  let companyId: number;

  // Unique IP so this file's requests use their own rate-limit bucket,
  // isolated from other test files.
  const IP = "127.0.0.12";

  // Fresh company + client before each test; the user is upserted so it always
  // exists even if user-routes.test.ts runs deleteMany().
  beforeEach(async () => {
    await prisma.serviceOrder.deleteMany();

    companyId = await createTestCompany("Order Routes Company");

    const user = await prisma.user.upsert({
      where: { email: "order-routes-test@example.com" },
      update: {},
      create: {
        email: "order-routes-test@example.com",
        password: "hashed",
        name: "Routes Tester",
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
        name: "Routes Test Client",
        document: "order-routes-doc-unique",
        clientType: "COUNTER",
        companyId,
      },
    });
    testClientId = client.id;

    token = await signTestToken(testUserId, user.email, companyId, "ADMIN");
  });

  const basePayload = () => ({
    description: "Screen replacement",
    items: [
      { description: "Screen replacement", unitValue: "250.00", quantity: 1 },
    ],
    clientId: testClientId,
  });

  // Headers helper: injects auth token + unique IP for rate-limit isolation
  const h = (extra?: Record<string, string>) => ({
    "X-Forwarded-For": IP,
    Authorization: `Bearer ${token}`,
    ...extra,
  });

  const post = (body: object) =>
    app.request("/api/orders", {
      method: "POST",
      body: JSON.stringify(body),
      headers: h({ "Content-Type": "application/json" }),
    });

  // ─── Auth guard ───────────────────────────────────────────────────

  describe("auth guard", () => {
    it("should return 401 on GET /api/orders without token", async () => {
      const res = await app.request("/api/orders", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 401 on POST /api/orders without token", async () => {
      const res = await app.request("/api/orders", {
        method: "POST",
        body: JSON.stringify(basePayload()),
        headers: { "Content-Type": "application/json", "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 401 on PATCH /api/orders/:id/status without token", async () => {
      const res = await app.request("/api/orders/1/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PROGRESS" }),
        headers: { "Content-Type": "application/json", "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/orders ─────────────────────────────────────────────

  describe("POST /api/orders", () => {
    it("should create an order and return 201", async () => {
      const res = await post(basePayload());
      const body = (await res.json()) as {
        success: boolean;
        data: {
          id: number;
          orderNumber: string;
          description: string;
          status: string;
          clientId: number;
        };
      };

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.description).toBe("Screen replacement");
      expect(body.data.status).toBe("PENDING");
      expect(body.data.clientId).toBe(testClientId);
      expect(body.data.orderNumber).toMatch(/^OS-\d{4}$/);
    });

    it("should generate sequential orderNumbers", async () => {
      const r1 = (await (await post(basePayload())).json()) as {
        data: { orderNumber: string };
      };
      const r2 = (await (
        await post({ ...basePayload(), description: "Battery replacement" })
      ).json()) as { data: { orderNumber: string } };

      const n1 = parseInt(r1.data.orderNumber.replace("OS-", ""), 10);
      const n2 = parseInt(r2.data.orderNumber.replace("OS-", ""), 10);
      expect(n2).toBe(n1 + 1);
    });

    it("should return 400 when description is missing", async () => {
      const res = await post({
        items: [{ description: "Item", unitValue: "100.00", quantity: 1 }],
        clientId: testClientId,
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 when items array is empty", async () => {
      const res = await post({ ...basePayload(), items: [] });
      expect(res.status).toBe(400);
    });

    it("should return 400 when unitValue format is invalid", async () => {
      const res = await post({
        ...basePayload(),
        items: [
          { description: "Item", unitValue: "not-a-number", quantity: 1 },
        ],
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 when clientId is missing", async () => {
      const res = await post({
        description: "Test",
        items: [{ description: "Item", unitValue: "100.00", quantity: 1 }],
      });
      expect(res.status).toBe(400);
    });

    it("should return 404 when clientId does not exist", async () => {
      const res = await post({ ...basePayload(), clientId: 999999 });
      const body = (await res.json()) as { error: string };

      expect(res.status).toBe(404);
      expect(body.error).toBe("Client not found");
    });

    it("should return 404 when assignedUserId does not exist", async () => {
      const res = await post({ ...basePayload(), assignedUserId: 999999 });
      const body = (await res.json()) as { error: string };

      expect(res.status).toBe(404);
      expect(body.error).toBe("Assigned user not found");
    });

    it("should create an order assigned to a company member", async () => {
      const res = await post({ ...basePayload(), assignedUserId: testUserId });
      const body = (await res.json()) as {
        data: { assignedUserId: number };
      };

      expect(res.status).toBe(201);
      expect(body.data.assignedUserId).toBe(testUserId);
    });

    it("should default paymentStatus to UNPAID", async () => {
      const res = await post(basePayload());
      const body = (await res.json()) as {
        data: { paymentStatus: string; paymentNote: string | null };
      };

      expect(res.status).toBe(201);
      expect(body.data.paymentStatus).toBe("UNPAID");
      expect(body.data.paymentNote).toBeNull();
    });

    it("should persist a PAID_OTHER payment with its note", async () => {
      const res = await post({
        ...basePayload(),
        paymentStatus: "PAID_OTHER",
        paymentNote: "Cheque",
      });
      const body = (await res.json()) as {
        data: { paymentStatus: string; paymentNote: string | null };
      };

      expect(res.status).toBe(201);
      expect(body.data.paymentStatus).toBe("PAID_OTHER");
      expect(body.data.paymentNote).toBe("Cheque");
    });
  });

  // ─── GET /api/orders ──────────────────────────────────────────────

  describe("GET /api/orders", () => {
    it("should return paginated order list", async () => {
      await post(basePayload());
      await post({ ...basePayload(), description: "Battery replacement" });

      const res = await app.request("/api/orders", { headers: h() });
      const body = (await res.json()) as {
        success: boolean;
        data: { orders: unknown[]; pagination: { total: number } };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.orders.length).toBe(2);
      expect(body.data.pagination.total).toBe(2);
    });

    it("should filter by status", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };
      await post({ ...basePayload(), description: "Other order" });

      await app.request(`/api/orders/${created.data.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PROGRESS" }),
        headers: h({ "Content-Type": "application/json" }),
      });

      const res = await app.request("/api/orders?status=IN_PROGRESS", {
        headers: h(),
      });
      const body = (await res.json()) as {
        data: { orders: Array<{ status: string }> };
      };

      expect(res.status).toBe(200);
      expect(body.data.orders.length).toBe(1);
      expect(body.data.orders[0]?.status).toBe("IN_PROGRESS");
    });

    it("should search by orderNumber", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { orderNumber: string };
      };
      await post({ ...basePayload(), description: "Other order" });

      const res = await app.request(
        `/api/orders?search=${created.data.orderNumber}`,
        { headers: h() },
      );
      const body = (await res.json()) as {
        data: { orders: Array<{ orderNumber: string }> };
      };

      expect(res.status).toBe(200);
      expect(body.data.orders.length).toBe(1);
      expect(body.data.orders[0]?.orderNumber).toBe(created.data.orderNumber);
    });

    it("should search by client name", async () => {
      await post(basePayload());

      const res = await app.request("/api/orders?search=Routes+Test+Client", {
        headers: h(),
      });
      const body = (await res.json()) as {
        data: { orders: unknown[] };
      };

      expect(res.status).toBe(200);
      expect(body.data.orders.length).toBe(1);
    });

    it("should respect pagination params", async () => {
      await post(basePayload());
      await post({ ...basePayload(), description: "Second" });

      const res = await app.request("/api/orders?page=1&limit=1", {
        headers: h(),
      });
      const body = (await res.json()) as {
        data: {
          orders: unknown[];
          pagination: { total: number; totalPages: number };
        };
      };

      expect(res.status).toBe(200);
      expect(body.data.orders.length).toBe(1);
      expect(body.data.pagination.total).toBe(2);
      expect(body.data.pagination.totalPages).toBe(2);
    });

    it("should filter by payment situation", async () => {
      await post(basePayload());
      await post({ ...basePayload(), paymentStatus: "PAID_PIX" });

      const res = await app.request("/api/orders?payment=paid", {
        headers: h(),
      });
      const body = (await res.json()) as {
        data: { orders: Array<{ paymentStatus: string }> };
      };

      expect(res.status).toBe(200);
      expect(body.data.orders.length).toBe(1);
      expect(body.data.orders[0]?.paymentStatus).toBe("PAID_PIX");
    });

    it("should filter orders by the client's partner name", async () => {
      // Default order belongs to the COUNTER client (no partner).
      await post(basePayload());

      // A second order belongs to a PARTNER client.
      const partnerEntity = await prisma.partner.create({
        data: { name: "Acme Partner", companyId },
      });
      const partnerClient = await prisma.client.create({
        data: {
          name: "Partner Client",
          document: "order-routes-partner-doc",
          clientType: "PARTNER",
          partnerId: partnerEntity.id,
          companyId,
        },
      });
      await post({ ...basePayload(), clientId: partnerClient.id });

      const res = await app.request("/api/orders?partnerName=Acme", {
        headers: h(),
      });
      const body = (await res.json()) as {
        data: { orders: Array<{ clientId: number }> };
      };

      expect(res.status).toBe(200);
      expect(body.data.orders.length).toBe(1);
      expect(body.data.orders[0]?.clientId).toBe(partnerClient.id);
    });
  });

  // ─── GET /api/orders/:id ──────────────────────────────────────────

  describe("GET /api/orders/:id", () => {
    it("should return an order with client and statusHistory", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/orders/${created.data.id}`, {
        headers: h(),
      });
      const body = (await res.json()) as {
        success: boolean;
        data: {
          id: number;
          client: { id: number };
          statusHistory: unknown[];
        };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(created.data.id);
      expect(body.data.client.id).toBe(testClientId);
      expect(Array.isArray(body.data.statusHistory)).toBe(true);
      expect(body.data.statusHistory.length).toBe(1);
    });

    it("should return 404 for a non-existent id", async () => {
      const res = await app.request("/api/orders/999999", { headers: h() });
      expect(res.status).toBe(404);
    });

    it("should include the client's partner in detail for a PARTNER client", async () => {
      const partnerEntity = await prisma.partner.create({
        data: { name: "Beta Partner", companyId },
      });
      const partnerClient = await prisma.client.create({
        data: {
          name: "Partner Detail Client",
          document: "order-routes-partner-detail-doc",
          clientType: "PARTNER",
          partnerId: partnerEntity.id,
          companyId,
        },
      });
      const created = (await (
        await post({ ...basePayload(), clientId: partnerClient.id })
      ).json()) as { data: { id: number } };

      const res = await app.request(`/api/orders/${created.data.id}`, {
        headers: h(),
      });
      const body = (await res.json()) as {
        data: {
          client: {
            clientType: string;
            partner: { id: number; name: string } | null;
          };
        };
      };

      expect(res.status).toBe(200);
      expect(body.data.client.clientType).toBe("PARTNER");
      expect(body.data.client.partner?.name).toBe("Beta Partner");
    });
  });

  // ─── PUT /api/orders/:id ──────────────────────────────────────────

  describe("PUT /api/orders/:id", () => {
    it("should update an order and return 200", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/orders/${created.data.id}`, {
        method: "PUT",
        body: JSON.stringify({ description: "Updated description" }),
        headers: h({ "Content-Type": "application/json" }),
      });
      const body = (await res.json()) as { data: { description: string } };

      expect(res.status).toBe(200);
      expect(body.data.description).toBe("Updated description");
    });

    it("should return 404 when updating a non-existent order", async () => {
      const res = await app.request("/api/orders/999999", {
        method: "PUT",
        body: JSON.stringify({ description: "Any" }),
        headers: h({ "Content-Type": "application/json" }),
      });
      expect(res.status).toBe(404);
    });

    it("should return 404 when assignedUserId does not exist", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/orders/${created.data.id}`, {
        method: "PUT",
        body: JSON.stringify({ assignedUserId: 999999 }),
        headers: h({ "Content-Type": "application/json" }),
      });
      const body = (await res.json()) as { error: string };

      expect(res.status).toBe(404);
      expect(body.error).toBe("Assigned user not found");
    });
  });

  // ─── PATCH /api/orders/:id/status ────────────────────────────────

  describe("PATCH /api/orders/:id/status", () => {
    it("should change order status and return 200 with detail", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/orders/${created.data.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PROGRESS" }),
        headers: h({ "Content-Type": "application/json" }),
      });
      const body = (await res.json()) as {
        success: boolean;
        data: { status: string; statusHistory: unknown[] };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("IN_PROGRESS");
      expect(body.data.statusHistory.length).toBe(2);
    });

    it("should record fromStatus and toStatus in history", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/orders/${created.data.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PROGRESS", note: "Starting work" }),
        headers: h({ "Content-Type": "application/json" }),
      });
      const body = (await res.json()) as {
        data: {
          statusHistory: Array<{
            fromStatus: string | null;
            toStatus: string;
            note: string | null;
            changedBy: { id: number };
          }>;
        };
      };

      const lastEntry =
        body.data.statusHistory[body.data.statusHistory.length - 1];
      expect(lastEntry?.fromStatus).toBe("PENDING");
      expect(lastEntry?.toStatus).toBe("IN_PROGRESS");
      expect(lastEntry?.note).toBe("Starting work");
      expect(lastEntry?.changedBy.id).toBe(testUserId);
    });

    it("should allow multiple sequential status changes", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };
      const id = created.data.id;

      await app.request(`/api/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PROGRESS" }),
        headers: h({ "Content-Type": "application/json" }),
      });

      const res = await app.request(`/api/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
        headers: h({ "Content-Type": "application/json" }),
      });
      const body = (await res.json()) as {
        data: { status: string; statusHistory: unknown[] };
      };

      expect(res.status).toBe(200);
      expect(body.data.status).toBe("COMPLETED");
      expect(body.data.statusHistory.length).toBe(3);
    });

    it("should return 400 for an invalid status value", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/orders/${created.data.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "INVALID_STATUS" }),
        headers: h({ "Content-Type": "application/json" }),
      });
      expect(res.status).toBe(400);
    });

    it("should return 404 for a non-existent order", async () => {
      const res = await app.request("/api/orders/999999/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PROGRESS" }),
        headers: h({ "Content-Type": "application/json" }),
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/orders/:id ───────────────────────────────────────

  describe("DELETE /api/orders/:id", () => {
    it("should delete an order and return 200", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/orders/${created.data.id}`, {
        method: "DELETE",
        headers: h(),
      });
      const body = (await res.json()) as { success: boolean };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("should return 404 when deleting a non-existent order", async () => {
      const res = await app.request("/api/orders/999999", {
        method: "DELETE",
        headers: h(),
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should return 400 on GET with a non-numeric id", async () => {
      const res = await app.request("/api/orders/abc", { headers: h() });
      expect(res.status).toBe(400);
    });

    it("should return 400 on PATCH status with a non-numeric id", async () => {
      const res = await app.request("/api/orders/abc/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PROGRESS" }),
        headers: h({ "Content-Type": "application/json" }),
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 on DELETE with a non-numeric id", async () => {
      const res = await app.request("/api/orders/abc", {
        method: "DELETE",
        headers: h(),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Security headers ─────────────────────────────────────────────

  describe("security headers", () => {
    it("should include X-Content-Type-Options: nosniff", async () => {
      const res = await app.request("/api/orders", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });
  });
});
