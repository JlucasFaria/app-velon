// Integration tests for role-based permission enforcement across domains.
// These tests only verify that the permission gate returns the right HTTP status
// code — not the full business-logic response — so they use lightweight synthetic
// tokens pointing at a single shared company.
import { describe, it, expect, beforeAll } from "bun:test";
import app from "../../index";
import prisma from "../../db/client";
import {
  createTestAuthContext,
  signTestToken,
  type TestAuthContext,
} from "../../test-utils/company";

// Unique IP per file to avoid rate-limit bucket collisions.
const IP = "127.0.0.32";
const h = (token: string) => ({
  "X-Forwarded-For": IP,
  Authorization: `Bearer ${token}`,
});
const json = (token: string) => ({
  ...h(token),
  "Content-Type": "application/json",
});

// One shared company for all tests. Tokens are signed per-test with the
// desired role so no DB membership rows are needed for the permission checks
// (requireMinRole reads role from the JWT payload, not from the DB).
let adminCtx: TestAuthContext;
let operatorToken: string;
let viewerToken: string;

beforeAll(async () => {
  adminCtx = await createTestAuthContext({ role: "ADMIN" });
  operatorToken = await signTestToken(
    adminCtx.userId,
    adminCtx.email,
    adminCtx.companyId,
    "OPERATOR",
  );
  viewerToken = await signTestToken(
    adminCtx.userId,
    adminCtx.email,
    adminCtx.companyId,
    "VIEWER",
  );
});

// Deletes the company-scoped client records from this test's company only,
// called by tests that create clients to avoid polluting other test companies.
async function cleanClientsByCompany(companyId: number) {
  await prisma.client.deleteMany({ where: { companyId } });
}

// ─── Clients ────────────────────────────────────────────────────────────────

describe("Clients — write requires OPERATOR+", () => {
  it("VIEWER: POST /api/clients → 403", async () => {
    const res = await app.request("/api/clients", {
      method: "POST",
      body: JSON.stringify({
        name: "X",
        document: "12345678000100",
        clientType: "COUNTER",
      }),
      headers: json(viewerToken),
    });
    expect(res.status).toBe(403);
  });

  it("OPERATOR: POST /api/clients → not 403 (creates or conflicts)", async () => {
    const doc = `${Date.now()}`.slice(-14).padStart(14, "0");
    const res = await app.request("/api/clients", {
      method: "POST",
      body: JSON.stringify({
        name: "Op Client",
        document: doc,
        clientType: "COUNTER",
      }),
      headers: json(operatorToken),
    });
    // 201 = created, 409 = document conflict — either means the permission gate passed
    expect(res.status).not.toBe(403);
    await cleanClientsByCompany(adminCtx.companyId);
  });

  it("VIEWER: PUT /api/clients/1 → 403", async () => {
    const res = await app.request("/api/clients/1", {
      method: "PUT",
      body: JSON.stringify({
        name: "X",
        document: "00000000000001",
        clientType: "COUNTER",
      }),
      headers: json(viewerToken),
    });
    expect(res.status).toBe(403);
  });

  it("VIEWER: DELETE /api/clients/1 → 403", async () => {
    const res = await app.request("/api/clients/1", {
      method: "DELETE",
      headers: h(viewerToken),
    });
    expect(res.status).toBe(403);
  });

  it("VIEWER: GET /api/clients → 200 (read is allowed for all roles)", async () => {
    const res = await app.request("/api/clients", { headers: h(viewerToken) });
    expect(res.status).toBe(200);
  });

  it("OPERATOR: GET /api/clients → 200 (read is allowed for all roles)", async () => {
    const res = await app.request("/api/clients", {
      headers: h(operatorToken),
    });
    expect(res.status).toBe(200);
  });
});

// ─── Orders ─────────────────────────────────────────────────────────────────

describe("Orders — write requires OPERATOR+", () => {
  it("VIEWER: POST /api/orders → 403", async () => {
    const res = await app.request("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        description: "Test",
        value: "100.00",
        clientId: 1,
      }),
      headers: json(viewerToken),
    });
    expect(res.status).toBe(403);
  });

  it("VIEWER: PUT /api/orders/1 → 403", async () => {
    const res = await app.request("/api/orders/1", {
      method: "PUT",
      body: JSON.stringify({ description: "X", value: "10.00", clientId: 1 }),
      headers: json(viewerToken),
    });
    expect(res.status).toBe(403);
  });

  it("VIEWER: DELETE /api/orders/1 → 403", async () => {
    const res = await app.request("/api/orders/1", {
      method: "DELETE",
      headers: h(viewerToken),
    });
    expect(res.status).toBe(403);
  });

  it("VIEWER: PATCH /api/orders/1/status → 403", async () => {
    const res = await app.request("/api/orders/1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
      headers: json(viewerToken),
    });
    expect(res.status).toBe(403);
  });

  it("VIEWER: GET /api/orders → 200 (read is allowed for all roles)", async () => {
    const res = await app.request("/api/orders", { headers: h(viewerToken) });
    expect(res.status).toBe(200);
  });

  it("OPERATOR: GET /api/orders → 200 (read is allowed for all roles)", async () => {
    const res = await app.request("/api/orders", { headers: h(operatorToken) });
    expect(res.status).toBe(200);
  });
});

// ─── Receipts ────────────────────────────────────────────────────────────────

describe("Receipts — generate requires OPERATOR+; GET is open to all roles", () => {
  it("VIEWER: POST /api/orders/1/receipt → 403", async () => {
    const res = await app.request("/api/orders/1/receipt", {
      method: "POST",
      headers: h(viewerToken),
    });
    expect(res.status).toBe(403);
  });

  it("OPERATOR: POST /api/orders/1/receipt → not 403 (fails at business logic, not permission)", async () => {
    const res = await app.request("/api/orders/1/receipt", {
      method: "POST",
      headers: h(operatorToken),
    });
    // 404 = order not found — permission gate passed
    expect(res.status).not.toBe(403);
  });

  it("VIEWER: GET /api/orders/1/receipt → not 403 (read is allowed)", async () => {
    const res = await app.request("/api/orders/1/receipt", {
      headers: h(viewerToken),
    });
    // 404 = order not found — permission gate passed
    expect(res.status).not.toBe(403);
  });
});

// ─── Company management ──────────────────────────────────────────────────────

describe("Company management — requires ADMIN", () => {
  it("OPERATOR: PATCH /api/company → 403", async () => {
    const res = await app.request("/api/company", {
      method: "PATCH",
      body: JSON.stringify({ name: "Hack" }),
      headers: json(operatorToken),
    });
    expect(res.status).toBe(403);
  });

  it("VIEWER: PATCH /api/company → 403", async () => {
    const res = await app.request("/api/company", {
      method: "PATCH",
      body: JSON.stringify({ name: "Hack" }),
      headers: json(viewerToken),
    });
    expect(res.status).toBe(403);
  });

  it("ADMIN: PATCH /api/company → not 403", async () => {
    const res = await app.request("/api/company", {
      method: "PATCH",
      body: JSON.stringify({ name: `Novo Nome ${Date.now()}` }),
      headers: json(adminCtx.token),
    });
    expect(res.status).not.toBe(403);
  });

  it("OPERATOR: POST /api/company/logo → 403", async () => {
    const res = await app.request("/api/company/logo", {
      method: "POST",
      body: "fake",
      headers: { ...h(operatorToken), "Content-Type": "image/png" },
    });
    expect(res.status).toBe(403);
  });

  it("VIEWER: POST /api/company/logo → 403", async () => {
    const res = await app.request("/api/company/logo", {
      method: "POST",
      body: "fake",
      headers: { ...h(viewerToken), "Content-Type": "image/png" },
    });
    expect(res.status).toBe(403);
  });
});

// ─── Member management ───────────────────────────────────────────────────────

describe("Member management — all routes require ADMIN", () => {
  it("OPERATOR: GET /api/company/members → 403", async () => {
    const res = await app.request("/api/company/members", {
      headers: h(operatorToken),
    });
    expect(res.status).toBe(403);
  });

  it("VIEWER: GET /api/company/members → 403", async () => {
    const res = await app.request("/api/company/members", {
      headers: h(viewerToken),
    });
    expect(res.status).toBe(403);
  });

  it("ADMIN: GET /api/company/members → 200", async () => {
    const res = await app.request("/api/company/members", {
      headers: h(adminCtx.token),
    });
    expect(res.status).toBe(200);
  });

  it("OPERATOR: POST /api/company/members/invite → 403", async () => {
    const res = await app.request("/api/company/members/invite", {
      method: "POST",
      body: JSON.stringify({ email: "x@x.com", role: "OPERATOR" }),
      headers: json(operatorToken),
    });
    expect(res.status).toBe(403);
  });

  it("OPERATOR: PATCH /api/company/members/1/role → 403", async () => {
    const res = await app.request("/api/company/members/1/role", {
      method: "PATCH",
      body: JSON.stringify({ role: "VIEWER" }),
      headers: json(operatorToken),
    });
    expect(res.status).toBe(403);
  });

  it("OPERATOR: PATCH /api/company/members/1/revoke → 403", async () => {
    const res = await app.request("/api/company/members/1/revoke", {
      method: "PATCH",
      headers: h(operatorToken),
    });
    expect(res.status).toBe(403);
  });

  it("OPERATOR: DELETE /api/company/members/1 → 403", async () => {
    const res = await app.request("/api/company/members/1", {
      method: "DELETE",
      headers: h(operatorToken),
    });
    expect(res.status).toBe(403);
  });
});
