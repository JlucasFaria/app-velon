import { describe, it, expect, beforeEach } from "bun:test";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import { signTestToken, createTestCompany } from "../../../test-utils/company";

describe("Receipt Routes", () => {
  let token: string;
  let testUserId: number;
  let testClientId: number;
  let companyId: number;

  // Unique IP to isolate rate-limit bucket from other test files
  const IP = "127.0.0.13";

  beforeEach(async () => {
    await prisma.receipt.deleteMany();
    await prisma.serviceOrder.deleteMany();

    companyId = await createTestCompany("Receipt Routes Company");

    const user = await prisma.user.upsert({
      where: { email: "receipt-routes-test@example.com" },
      update: {},
      create: {
        email: "receipt-routes-test@example.com",
        password: "hashed",
        name: "Receipt Routes Tester",
      },
    });
    testUserId = user.id;

    const client = await prisma.client.create({
      data: {
        name: "Receipt Routes Client",
        document: "receipt-routes-doc-unique",
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

  const createOrder = async () => {
    const res = await app.request("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        description: "Screen replacement",
        items: [
          {
            description: "Screen replacement",
            unitValue: "250.00",
            quantity: 1,
          },
        ],
        clientId: testClientId,
      }),
      headers: h({ "Content-Type": "application/json" }),
    });
    const body = (await res.json()) as { data: { id: number } };
    return body.data.id;
  };

  // ─── Auth guard ───────────────────────────────────────────────────

  describe("auth guard", () => {
    it("should return 401 on POST /api/orders/:id/receipt without token", async () => {
      const res = await app.request("/api/orders/1/receipt", {
        method: "POST",
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 401 on GET /api/orders/:id/receipt without token", async () => {
      const res = await app.request("/api/orders/1/receipt", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/orders/:id/receipt ────────────────────────────────

  describe("POST /api/orders/:id/receipt", () => {
    it("should generate a receipt and return 200", async () => {
      const orderId = await createOrder();

      const res = await app.request(`/api/orders/${orderId}/receipt`, {
        method: "POST",
        headers: h(),
      });
      const body = (await res.json()) as {
        success: boolean;
        data: {
          id: number;
          receiptNumber: number;
          issuedAt: string;
          order: {
            id: number;
            orderNumber: string;
            description: string;
            value: string;
            client: { id: number; name: string; document: string };
          };
        };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.receiptNumber).toBeDefined();
      expect(body.data.issuedAt).toBeDefined();
      expect(body.data.order.id).toBe(orderId);
      expect(body.data.order.description).toBe("Screen replacement");
      expect(body.data.order.client.id).toBe(testClientId);
    });

    it("should return the same receipt on a second POST (idempotent)", async () => {
      const orderId = await createOrder();

      const r1 = (await (
        await app.request(`/api/orders/${orderId}/receipt`, {
          method: "POST",
          headers: h(),
        })
      ).json()) as { data: { id: number; receiptNumber: number } };

      const r2 = (await (
        await app.request(`/api/orders/${orderId}/receipt`, {
          method: "POST",
          headers: h(),
        })
      ).json()) as { data: { id: number; receiptNumber: number } };

      expect(r1.data.id).toBe(r2.data.id);
      expect(r1.data.receiptNumber).toBe(r2.data.receiptNumber);
    });

    it("should return 404 when order does not exist", async () => {
      const res = await app.request("/api/orders/999999/receipt", {
        method: "POST",
        headers: h(),
      });
      const body = (await res.json()) as { error: string };

      expect(res.status).toBe(404);
      expect(body.error).toBe("Order not found");
    });

    it("should return 400 for a non-numeric order id", async () => {
      const res = await app.request("/api/orders/abc/receipt", {
        method: "POST",
        headers: h(),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/orders/:id/receipt ─────────────────────────────────

  describe("GET /api/orders/:id/receipt", () => {
    it("should retrieve a receipt after it has been generated", async () => {
      const orderId = await createOrder();

      await app.request(`/api/orders/${orderId}/receipt`, {
        method: "POST",
        headers: h(),
      });

      const res = await app.request(`/api/orders/${orderId}/receipt`, {
        headers: h(),
      });
      const body = (await res.json()) as {
        success: boolean;
        data: { order: { id: number } };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.order.id).toBe(orderId);
    });

    it("should return 404 when no receipt exists for the order", async () => {
      const orderId = await createOrder();

      const res = await app.request(`/api/orders/${orderId}/receipt`, {
        headers: h(),
      });
      const body = (await res.json()) as { error: string };

      expect(res.status).toBe(404);
      expect(body.error).toBe("Receipt not found");
    });

    it("should return 404 (Receipt not found) when order does not exist", async () => {
      const res = await app.request("/api/orders/999999/receipt", {
        headers: h(),
      });
      const body = (await res.json()) as { error: string };

      expect(res.status).toBe(404);
      expect(body.error).toBe("Receipt not found");
    });

    it("should return 400 for a non-numeric order id", async () => {
      const res = await app.request("/api/orders/abc/receipt", {
        headers: h(),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Security headers ─────────────────────────────────────────────

  describe("security headers", () => {
    it("should include X-Content-Type-Options: nosniff", async () => {
      const res = await app.request("/api/orders/1/receipt", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });
  });
});
