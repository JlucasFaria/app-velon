import { describe, it, expect } from "bun:test";
import { sign } from "hono/jwt";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import { createTestAuthContext } from "../../../test-utils/company";
import { env } from "../../../config/env";

// Unique IP isolates this file's rate-limit bucket from other test files.
const IP = "127.0.0.40";

// ─── Test helpers ──────────────────────────────────────────────────────────────

async function setupOrderFixture(companyId: number, userId: number) {
  const document = `pdf-test-doc-${crypto.randomUUID()}`;
  const client = await prisma.client.create({
    data: {
      name: "PDF Test Client",
      document,
      clientType: "PARTNER",
      companyId,
    },
  });

  const order = await prisma.serviceOrder.create({
    data: {
      orderNumber: `OS-PDF-${crypto.randomUUID().slice(0, 6)}`,
      description: "Troca de tela",
      value: "250.00",
      status: "COMPLETED",
      paymentStatus: "PAID_PIX",
      clientId: client.id,
      companyId,
      items: {
        create: [
          {
            description: "Tela",
            category: "Peça",
            unitValue: "200.00",
            quantity: 1,
            subtotal: "200.00",
          },
          {
            description: "Mão de obra",
            category: "Honorário",
            unitValue: "50.00",
            quantity: 1,
            subtotal: "50.00",
          },
        ],
      },
      statusHistory: {
        create: { toStatus: "PENDING", changedById: userId },
      },
    },
  });

  return { order, client };
}

async function cleanupFixture(
  orderId: number,
  clientId: number,
  companyId: number,
  userId: number,
) {
  await prisma.serviceOrder.deleteMany({ where: { id: orderId } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.membership.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

// Builds a signed pdf-share token with an explicit exp so tests can forge
// an already-expired link without sleeping.
async function signShareToken(
  orderId: number,
  companyId: number,
  expOffsetSeconds: number,
): Promise<string> {
  return sign(
    {
      kind: "pdf-share",
      orderId,
      companyId,
      exp: Math.floor(Date.now() / 1000) + expOffsetSeconds,
    },
    env.JWT_SECRET,
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("PDF Routes", () => {
  // ─── GET /api/pdf/orders/:id ──────────────────────────────────────

  describe("GET /api/pdf/orders/:id — authenticated download", () => {
    it("should return a PDF file for a valid order", async () => {
      const ctx = await createTestAuthContext();
      const { order, client } = await setupOrderFixture(
        ctx.companyId,
        ctx.userId,
      );

      const res = await app.request(`/api/pdf/orders/${order.id}`, {
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          "X-Forwarded-For": IP,
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Content-Disposition")).toContain("attachment");

      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

      await cleanupFixture(order.id, client.id, ctx.companyId, ctx.userId);
    });

    it("should return 401 without a token", async () => {
      const res = await app.request("/api/pdf/orders/1", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 404 when order does not belong to the company", async () => {
      const ctx = await createTestAuthContext();
      const other = await createTestAuthContext();
      const { order, client } = await setupOrderFixture(
        other.companyId,
        other.userId,
      );

      const res = await app.request(`/api/pdf/orders/${order.id}`, {
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          "X-Forwarded-For": IP,
        },
      });

      expect(res.status).toBe(404);

      await cleanupFixture(order.id, client.id, other.companyId, other.userId);
      await prisma.membership.deleteMany({
        where: { companyId: ctx.companyId },
      });
      await prisma.company.deleteMany({ where: { id: ctx.companyId } });
      await prisma.user.deleteMany({ where: { id: ctx.userId } });
    });

    it("should return 404 for a non-existent order id", async () => {
      const ctx = await createTestAuthContext();

      const res = await app.request("/api/pdf/orders/999999999", {
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          "X-Forwarded-For": IP,
        },
      });
      expect(res.status).toBe(404);

      await prisma.membership.deleteMany({
        where: { companyId: ctx.companyId },
      });
      await prisma.company.deleteMany({ where: { id: ctx.companyId } });
      await prisma.user.deleteMany({ where: { id: ctx.userId } });
    });
  });

  // ─── POST /api/pdf/orders/:id/share ──────────────────────────────

  describe("POST /api/pdf/orders/:id/share — share link generation", () => {
    it("should return a signed URL and expiresAt for a valid order", async () => {
      const ctx = await createTestAuthContext();
      const { order, client } = await setupOrderFixture(
        ctx.companyId,
        ctx.userId,
      );

      const res = await app.request(`/api/pdf/orders/${order.id}/share`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          "X-Forwarded-For": IP,
        },
      });
      const body = (await res.json()) as {
        success: boolean;
        data: { url: string; expiresAt: string };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.url).toContain("/api/pdf/shared/");
      const expiresAt = new Date(body.data.expiresAt);
      const diffMs = expiresAt.getTime() - Date.now();
      // Should be ~7 days (accept a small drift window)
      expect(diffMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
      expect(diffMs).toBeLessThan(8 * 24 * 60 * 60 * 1000);

      await cleanupFixture(order.id, client.id, ctx.companyId, ctx.userId);
    });

    it("should return 401 without a token", async () => {
      const res = await app.request("/api/pdf/orders/1/share", {
        method: "POST",
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 404 for a non-existent order", async () => {
      const ctx = await createTestAuthContext();

      const res = await app.request("/api/pdf/orders/999999999/share", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          "X-Forwarded-For": IP,
        },
      });
      expect(res.status).toBe(404);

      await prisma.membership.deleteMany({
        where: { companyId: ctx.companyId },
      });
      await prisma.company.deleteMany({ where: { id: ctx.companyId } });
      await prisma.user.deleteMany({ where: { id: ctx.userId } });
    });
  });

  // ─── GET /api/pdf/shared/:token ──────────────────────────────────

  describe("GET /api/pdf/shared/:token — public signed download", () => {
    it("should serve the PDF inline for a valid token", async () => {
      const ctx = await createTestAuthContext();
      const { order, client } = await setupOrderFixture(
        ctx.companyId,
        ctx.userId,
      );

      // Obtain a share token via the authenticated endpoint.
      const shareRes = await app.request(`/api/pdf/orders/${order.id}/share`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          "X-Forwarded-For": IP,
        },
      });
      const { data } = (await shareRes.json()) as {
        data: { url: string };
      };
      const tokenPath = new URL(data.url).pathname;

      const res = await app.request(tokenPath, {
        headers: { "X-Forwarded-For": IP },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Content-Disposition")).toContain("inline");

      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

      await cleanupFixture(order.id, client.id, ctx.companyId, ctx.userId);
    });

    it("should return 410 for an expired token", async () => {
      const ctx = await createTestAuthContext();
      const { order, client } = await setupOrderFixture(
        ctx.companyId,
        ctx.userId,
      );

      // Forge a token that expired 1 second ago.
      const expiredToken = await signShareToken(order.id, ctx.companyId, -1);

      const res = await app.request(`/api/pdf/shared/${expiredToken}`, {
        headers: { "X-Forwarded-For": IP },
      });
      const body = (await res.json()) as { error: string };

      expect(res.status).toBe(410);
      expect(body.error).toBeDefined();

      await cleanupFixture(order.id, client.id, ctx.companyId, ctx.userId);
    });

    it("should return 404 for a tampered or invalid token", async () => {
      const res = await app.request("/api/pdf/shared/this-is-not-a-valid-jwt", {
        headers: { "X-Forwarded-For": IP },
      });
      const body = (await res.json()) as { error: string };

      expect(res.status).toBe(404);
      expect(body.error).toBe("Share link not found");
    });

    it("should return 404 when the order was deleted after the token was signed", async () => {
      const ctx = await createTestAuthContext();
      const { order, client } = await setupOrderFixture(
        ctx.companyId,
        ctx.userId,
      );

      const validToken = await signShareToken(order.id, ctx.companyId, 3600);

      // Delete the order so the PDF data query finds nothing.
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.statusHistory.deleteMany({ where: { orderId: order.id } });
      await prisma.serviceOrder.delete({ where: { id: order.id } });
      await prisma.client.delete({ where: { id: client.id } });

      const res = await app.request(`/api/pdf/shared/${validToken}`, {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(404);

      await prisma.membership.deleteMany({
        where: { companyId: ctx.companyId },
      });
      await prisma.company.deleteMany({ where: { id: ctx.companyId } });
      await prisma.user.deleteMany({ where: { id: ctx.userId } });
    });
  });

  // ─── POST /api/pdf/orders/:id/email ──────────────────────────────

  describe("POST /api/pdf/orders/:id/email — send by email", () => {
    it("should send the email and return the share URL", async () => {
      const ctx = await createTestAuthContext();
      const { order, client } = await setupOrderFixture(
        ctx.companyId,
        ctx.userId,
      );

      const res = await app.request(`/api/pdf/orders/${order.id}/email`, {
        method: "POST",
        body: JSON.stringify({ to: "cliente@exemplo.com" }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          "Content-Type": "application/json",
          "X-Forwarded-For": IP,
        },
      });
      const body = (await res.json()) as {
        success: boolean;
        data: { url: string; expiresAt: string };
        message: string;
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe("Email sent");
      expect(body.data.url).toContain("/api/pdf/shared/");
      expect(body.data.expiresAt).toBeDefined();

      await cleanupFixture(order.id, client.id, ctx.companyId, ctx.userId);
    });

    it("should accept optional subject and body fields", async () => {
      const ctx = await createTestAuthContext();
      const { order, client } = await setupOrderFixture(
        ctx.companyId,
        ctx.userId,
      );

      const res = await app.request(`/api/pdf/orders/${order.id}/email`, {
        method: "POST",
        body: JSON.stringify({
          to: "cliente@exemplo.com",
          subject: "Sua OS está pronta",
          body: "Acesse o PDF pelo link abaixo.",
        }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          "Content-Type": "application/json",
          "X-Forwarded-For": IP,
        },
      });

      expect(res.status).toBe(200);

      await cleanupFixture(order.id, client.id, ctx.companyId, ctx.userId);
    });

    it("should return 400 for an invalid recipient email", async () => {
      const ctx = await createTestAuthContext();
      const { order, client } = await setupOrderFixture(
        ctx.companyId,
        ctx.userId,
      );

      const res = await app.request(`/api/pdf/orders/${order.id}/email`, {
        method: "POST",
        body: JSON.stringify({ to: "not-an-email" }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          "Content-Type": "application/json",
          "X-Forwarded-For": IP,
        },
      });

      expect(res.status).toBe(400);

      await cleanupFixture(order.id, client.id, ctx.companyId, ctx.userId);
    });

    it("should return 401 without a token", async () => {
      const res = await app.request("/api/pdf/orders/1/email", {
        method: "POST",
        body: JSON.stringify({ to: "a@b.com" }),
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": IP,
        },
      });
      expect(res.status).toBe(401);
    });

    it("should return 404 for a non-existent order", async () => {
      const ctx = await createTestAuthContext();

      const res = await app.request("/api/pdf/orders/999999999/email", {
        method: "POST",
        body: JSON.stringify({ to: "a@b.com" }),
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          "Content-Type": "application/json",
          "X-Forwarded-For": IP,
        },
      });
      expect(res.status).toBe(404);

      await prisma.membership.deleteMany({
        where: { companyId: ctx.companyId },
      });
      await prisma.company.deleteMany({ where: { id: ctx.companyId } });
      await prisma.user.deleteMany({ where: { id: ctx.userId } });
    });
  });
});
