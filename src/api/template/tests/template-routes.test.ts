import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import { signTestToken, createTestCompany } from "../../../test-utils/company";

describe("Template Routes", () => {
  let token: string;
  let testUserId: number;
  let companyId: number;

  // Unique IP so this file's requests use their own rate-limit bucket,
  // isolated from other test files.
  const IP = "127.0.0.15";

  // Fresh company + user before each test; the user is upserted so it always
  // exists even if user-routes.test.ts runs deleteMany().
  beforeEach(async () => {
    companyId = await createTestCompany("Template Routes Company");

    const user = await prisma.user.upsert({
      where: { email: "template-routes-test@example.com" },
      update: {},
      create: {
        email: "template-routes-test@example.com",
        password: "hashed",
        name: "Template Tester",
      },
    });
    testUserId = user.id;

    await prisma.membership.upsert({
      where: { userId_companyId: { userId: user.id, companyId } },
      update: { role: "ADMIN", status: "ACTIVE" },
      create: { userId: user.id, companyId, role: "ADMIN", status: "ACTIVE" },
    });

    token = await signTestToken(testUserId, user.email, companyId, "ADMIN");
  });

  // Clean up only this test's data: cascade removes the company's templates and
  // their items, keeping parallel test files unaffected.
  afterEach(async () => {
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  const basePayload = () => ({
    name: `Formatação ${crypto.randomUUID()}`,
    defaultDescription: "Formatação completa com backup",
    items: [
      {
        description: "Honorário técnico",
        category: "Honorário",
        suggestedValue: "150.00",
        quantity: 1,
      },
    ],
  });

  // Headers helper: injects auth token + unique IP for rate-limit isolation.
  const h = (extra?: Record<string, string>) => ({
    "X-Forwarded-For": IP,
    Authorization: `Bearer ${token}`,
    ...extra,
  });

  const post = (body: object) =>
    app.request("/api/templates", {
      method: "POST",
      body: JSON.stringify(body),
      headers: h({ "Content-Type": "application/json" }),
    });

  // ─── Auth guard ───────────────────────────────────────────────────

  describe("auth guard", () => {
    it("should return 401 on GET /api/templates without token", async () => {
      const res = await app.request("/api/templates", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 401 on POST /api/templates without token", async () => {
      const res = await app.request("/api/templates", {
        method: "POST",
        body: JSON.stringify(basePayload()),
        headers: { "Content-Type": "application/json", "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/templates ──────────────────────────────────────────

  describe("POST /api/templates", () => {
    it("should create a template with items and return 201", async () => {
      const payload = basePayload();
      const res = await post(payload);
      const body = (await res.json()) as {
        success: boolean;
        data: {
          id: number;
          name: string;
          defaultDescription: string;
          items: Array<{
            description: string;
            category: string | null;
            suggestedValue: string;
            quantity: number | null;
          }>;
        };
      };

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe(payload.name);
      expect(body.data.defaultDescription).toBe(
        "Formatação completa com backup",
      );
      expect(body.data.items.length).toBe(1);
      expect(Number(body.data.items[0]?.suggestedValue)).toBe(150);
      expect(body.data.items[0]?.category).toBe("Honorário");
      expect(body.data.items[0]?.quantity).toBe(1);
    });

    it("should create a template with no items (empty array)", async () => {
      const res = await post({
        name: `Sem itens ${crypto.randomUUID()}`,
        defaultDescription: "Apenas descrição",
        items: [],
      });
      const body = (await res.json()) as { data: { items: unknown[] } };

      expect(res.status).toBe(201);
      expect(body.data.items.length).toBe(0);
    });

    it("should default items to an empty array when omitted", async () => {
      const res = await post({
        name: `Sem campo itens ${crypto.randomUUID()}`,
        defaultDescription: "Apenas descrição",
      });
      const body = (await res.json()) as { data: { items: unknown[] } };

      expect(res.status).toBe(201);
      expect(body.data.items.length).toBe(0);
    });

    it("should return 400 when name is missing", async () => {
      const res = await post({ defaultDescription: "x", items: [] });
      expect(res.status).toBe(400);
    });

    it("should return 400 when suggestedValue is invalid", async () => {
      const res = await post({
        name: `Inválido ${crypto.randomUUID()}`,
        defaultDescription: "x",
        items: [{ description: "Item", suggestedValue: "abc" }],
      });
      expect(res.status).toBe(400);
    });

    it("should return 409 when name is already in use in the company", async () => {
      const payload = basePayload();
      await post(payload);
      const res = await post(payload);
      expect(res.status).toBe(409);
    });
  });

  // ─── Permissions (OPERATOR+ for writes) ───────────────────────────

  describe("permissions", () => {
    it("should return 403 when a VIEWER tries to create a template", async () => {
      const viewerToken = await signTestToken(
        testUserId,
        "template-routes-test@example.com",
        companyId,
        "VIEWER",
      );
      const res = await app.request("/api/templates", {
        method: "POST",
        body: JSON.stringify(basePayload()),
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": IP,
          Authorization: `Bearer ${viewerToken}`,
        },
      });
      expect(res.status).toBe(403);
    });

    it("should allow a VIEWER to list templates", async () => {
      const viewerToken = await signTestToken(
        testUserId,
        "template-routes-test@example.com",
        companyId,
        "VIEWER",
      );
      const res = await app.request("/api/templates", {
        headers: {
          "X-Forwarded-For": IP,
          Authorization: `Bearer ${viewerToken}`,
        },
      });
      expect(res.status).toBe(200);
    });

    it("should allow an OPERATOR to create a template", async () => {
      const operatorToken = await signTestToken(
        testUserId,
        "template-routes-test@example.com",
        companyId,
        "OPERATOR",
      );
      const res = await app.request("/api/templates", {
        method: "POST",
        body: JSON.stringify(basePayload()),
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": IP,
          Authorization: `Bearer ${operatorToken}`,
        },
      });
      expect(res.status).toBe(201);
    });
  });

  // ─── GET /api/templates ───────────────────────────────────────────

  describe("GET /api/templates", () => {
    it("should list the company's templates ordered by name", async () => {
      await post({ ...basePayload(), name: "B Template" });
      await post({ ...basePayload(), name: "A Template" });

      const res = await app.request("/api/templates", { headers: h() });
      const body = (await res.json()) as {
        success: boolean;
        data: Array<{ name: string }>;
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(2);
      expect(body.data[0]?.name).toBe("A Template");
      expect(body.data[1]?.name).toBe("B Template");
    });

    it("should not return templates from another company", async () => {
      await post(basePayload());
      const otherCompanyId = await createTestCompany("Other Template Co");
      await prisma.serviceTemplate.create({
        data: {
          name: "Outro Template",
          defaultDescription: "x",
          companyId: otherCompanyId,
        },
      });

      const res = await app.request("/api/templates", { headers: h() });
      const body = (await res.json()) as { data: Array<{ name: string }> };

      expect(res.status).toBe(200);
      expect(body.data.length).toBe(1);
      expect(body.data.some((t) => t.name === "Outro Template")).toBe(false);

      await prisma.company.deleteMany({ where: { id: otherCompanyId } });
    });
  });

  // ─── GET /api/templates/:id ───────────────────────────────────────

  describe("GET /api/templates/:id", () => {
    it("should return a template with its items", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/templates/${created.data.id}`, {
        headers: h(),
      });
      const body = (await res.json()) as {
        data: { id: number; items: unknown[] };
      };

      expect(res.status).toBe(200);
      expect(body.data.id).toBe(created.data.id);
      expect(body.data.items.length).toBe(1);
    });

    it("should return 404 for a non-existent id", async () => {
      const res = await app.request("/api/templates/999999", {
        headers: h(),
      });
      expect(res.status).toBe(404);
    });

    it("should return 400 for a non-numeric id", async () => {
      const res = await app.request("/api/templates/abc", { headers: h() });
      expect(res.status).toBe(400);
    });

    it("should return 404 for a template owned by another company", async () => {
      const otherCompanyId = await createTestCompany("Cross Tenant Co");
      const other = await prisma.serviceTemplate.create({
        data: {
          name: "Cross Tenant Template",
          defaultDescription: "x",
          companyId: otherCompanyId,
        },
      });

      const res = await app.request(`/api/templates/${other.id}`, {
        headers: h(),
      });
      expect(res.status).toBe(404);

      await prisma.company.deleteMany({ where: { id: otherCompanyId } });
    });
  });

  // ─── PUT /api/templates/:id ───────────────────────────────────────

  describe("PUT /api/templates/:id", () => {
    it("should update name and defaultDescription", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/templates/${created.data.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: "Nome Atualizado" }),
        headers: h({ "Content-Type": "application/json" }),
      });
      const body = (await res.json()) as { data: { name: string } };

      expect(res.status).toBe(200);
      expect(body.data.name).toBe("Nome Atualizado");
    });

    it("should replace all items when items is provided", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/templates/${created.data.id}`, {
        method: "PUT",
        body: JSON.stringify({
          items: [
            { description: "Novo item", suggestedValue: "10.00" },
            { description: "Outro item", suggestedValue: "20.00", quantity: 2 },
          ],
        }),
        headers: h({ "Content-Type": "application/json" }),
      });
      const body = (await res.json()) as {
        data: {
          items: Array<{
            description: string;
            suggestedValue: string;
            quantity: number | null;
          }>;
        };
      };

      expect(res.status).toBe(200);
      expect(body.data.items.length).toBe(2);
      expect(body.data.items[0]?.description).toBe("Novo item");
      expect(body.data.items[0]?.quantity).toBeNull();
      expect(body.data.items[1]?.quantity).toBe(2);
    });

    it("should return 404 when updating a non-existent template", async () => {
      const res = await app.request("/api/templates/999999", {
        method: "PUT",
        body: JSON.stringify({ name: "Qualquer" }),
        headers: h({ "Content-Type": "application/json" }),
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/templates/:id ────────────────────────────────────

  describe("DELETE /api/templates/:id", () => {
    it("should delete a template and cascade its items", async () => {
      const created = (await (await post(basePayload())).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/templates/${created.data.id}`, {
        method: "DELETE",
        headers: h(),
      });
      const body = (await res.json()) as { success: boolean };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      const items = await prisma.serviceTemplateItem.findMany({
        where: { templateId: created.data.id },
      });
      expect(items.length).toBe(0);
    });

    it("should return 404 when deleting a non-existent template", async () => {
      const res = await app.request("/api/templates/999999", {
        method: "DELETE",
        headers: h(),
      });
      expect(res.status).toBe(404);
    });
  });
});
