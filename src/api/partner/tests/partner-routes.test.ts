import { describe, it, expect } from "bun:test";
import app from "../../../../src/index";
import {
  createTestAuthContext,
  signTestToken,
} from "../../../test-utils/company";

// Dedicated IP so this file's requests use their own rate-limit bucket.
const IP = "127.0.0.22";

const h = (token: string, extra?: Record<string, string>) => ({
  "X-Forwarded-For": IP,
  Authorization: `Bearer ${token}`,
  ...extra,
});

const json = (token: string) =>
  h(token, { "Content-Type": "application/json" });

const BASE = "/api/company/partners";

const postPartner = (token: string, name: string) =>
  app.request(BASE, {
    method: "POST",
    body: JSON.stringify({ name }),
    headers: json(token),
  });

describe("Partner Routes", () => {
  // ─── Auth guard ───────────────────────────────────────────────────

  describe("auth guard", () => {
    it("should return 401 on GET without token", async () => {
      const res = await app.request(BASE, {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 401 on POST without token", async () => {
      const res = await app.request(BASE, {
        method: "POST",
        body: JSON.stringify({ name: "Teste" }),
        headers: { "Content-Type": "application/json", "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 403 when the user has no company", async () => {
      const token = await signTestToken(
        1,
        "no-company-partner@test.com",
        null,
        null,
      );
      const res = await app.request(BASE, { headers: h(token) });
      expect(res.status).toBe(403);
    });
  });

  // ─── Permission guard ─────────────────────────────────────────────

  describe("permission guard", () => {
    it("should return 403 for a VIEWER on GET", async () => {
      const { token } = await createTestAuthContext({ role: "VIEWER" });
      const res = await app.request(BASE, { headers: h(token) });
      expect(res.status).toBe(403);
    });

    it("should return 403 for a VIEWER on POST", async () => {
      const { token } = await createTestAuthContext({ role: "VIEWER" });
      const res = await postPartner(token, "Qualquer");
      expect(res.status).toBe(403);
    });

    it("should return 200 for an OPERATOR on GET", async () => {
      const { token } = await createTestAuthContext({ role: "OPERATOR" });
      const res = await app.request(BASE, { headers: h(token) });
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/company/partners ────────────────────────────────────

  describe("GET /api/company/partners", () => {
    it("should return an empty list when no partners exist", async () => {
      const { token } = await createTestAuthContext();
      const res = await app.request(BASE, { headers: h(token) });
      const body = (await res.json()) as { success: boolean; data: unknown[] };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    it("should list partners with id, name, and companyId", async () => {
      const { token, companyId } = await createTestAuthContext();
      const name = `ListPartner-${crypto.randomUUID()}`;
      await postPartner(token, name);

      const res = await app.request(BASE, { headers: h(token) });
      const body = (await res.json()) as {
        data: Array<{ id: number; name: string; companyId: number }>;
      };

      expect(res.status).toBe(200);
      expect(body.data.length).toBe(1);
      expect(body.data[0]?.name).toBe(name);
      expect(body.data[0]?.companyId).toBe(companyId);
      expect(typeof body.data[0]?.id).toBe("number");
    });

    it("should filter by q (case-insensitive, partial match)", async () => {
      const { token } = await createTestAuthContext();
      const prefix = crypto.randomUUID().slice(0, 8);
      await postPartner(token, `${prefix}-Alpha Corp`);
      await postPartner(token, `${prefix}-Beta Ltda`);

      const res = await app.request(`${BASE}?q=alpha`, { headers: h(token) });
      const body = (await res.json()) as { data: Array<{ name: string }> };

      expect(res.status).toBe(200);
      expect(body.data.length).toBe(1);
      expect(body.data[0]?.name).toContain("Alpha Corp");
    });

    it("should not return partners from another company", async () => {
      const { token } = await createTestAuthContext({ companyName: "Co A" });
      const { token: otherToken } = await createTestAuthContext({
        companyName: "Co B",
      });
      const name = `IsolatedPartner-${crypto.randomUUID()}`;

      await postPartner(otherToken, name);

      const res = await app.request(BASE, { headers: h(token) });
      const body = (await res.json()) as { data: unknown[] };

      expect(res.status).toBe(200);
      expect(body.data.length).toBe(0);
    });

    it("should return partners ordered by name ascending", async () => {
      const { token } = await createTestAuthContext();
      const prefix = crypto.randomUUID().slice(0, 8);
      await postPartner(token, `${prefix}-Zeta`);
      await postPartner(token, `${prefix}-Alpha`);

      const res = await app.request(BASE, { headers: h(token) });
      const body = (await res.json()) as { data: Array<{ name: string }> };

      const names = body.data.map((p) => p.name);
      expect(names).toEqual([...names].sort());
    });
  });

  // ─── POST /api/company/partners ───────────────────────────────────

  describe("POST /api/company/partners", () => {
    it("should create a partner and return 201", async () => {
      const { token, companyId } = await createTestAuthContext();
      const name = `NewPartner-${crypto.randomUUID()}`;

      const res = await postPartner(token, name);
      const body = (await res.json()) as {
        success: boolean;
        data: { id: number; name: string; companyId: number };
      };

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe(name);
      expect(body.data.companyId).toBe(companyId);
    });

    it("should return 400 when name is missing", async () => {
      const { token } = await createTestAuthContext();
      const res = await app.request(BASE, {
        method: "POST",
        body: JSON.stringify({}),
        headers: json(token),
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 when name is shorter than 2 characters", async () => {
      const { token } = await createTestAuthContext();
      const res = await postPartner(token, "A");
      expect(res.status).toBe(400);
    });

    it("should return 409 when partner name already exists in the company", async () => {
      const { token } = await createTestAuthContext();
      const name = `DuplicatePartner-${crypto.randomUUID()}`;

      await postPartner(token, name);
      const res = await postPartner(token, name);

      expect(res.status).toBe(409);
    });

    it("should allow the same name in different companies", async () => {
      const { token: tokenA } = await createTestAuthContext({
        companyName: "Co A",
      });
      const { token: tokenB } = await createTestAuthContext({
        companyName: "Co B",
      });
      const name = `SharedPartner-${crypto.randomUUID()}`;

      const resA = await postPartner(tokenA, name);
      const resB = await postPartner(tokenB, name);

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);
    });
  });
});
