import { describe, it, expect } from "bun:test";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import { createTestAuthContext } from "../../../test-utils/company";

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

async function cleanupAuthContext(companyId: number, userId: number) {
  await prisma.membership.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("PDF Routes — GET /api/pdf/orders/:id (authenticated download)", () => {
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
    await cleanupAuthContext(ctx.companyId, ctx.userId);
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

    await cleanupAuthContext(ctx.companyId, ctx.userId);
  });
});
