import { describe, it, expect, beforeEach } from "bun:test";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import { signTestToken, createTestCompany } from "../../../test-utils/company";

describe("Client Routes", () => {
  let token: string;
  let companyId: number;

  beforeEach(async () => {
    // Delete in FK-safe order: orders reference clients.
    await prisma.serviceOrder.deleteMany();
    await prisma.client.deleteMany();
    companyId = await createTestCompany();
    token = await signTestToken(1, "test@example.com", companyId, "ADMIN");
  });

  const basePayload = {
    name: "João Silva",
    document: "123.456.789-00",
    clientType: "COUNTER",
  };

  const authHeader = () => ({ Authorization: `Bearer ${token}` });

  const post = (body: object) =>
    app.request("/api/clients", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", ...authHeader() },
    });

  // ─── Auth guard ──────────────────────────────────────────────────

  describe("auth guard", () => {
    it("should return 401 on GET /api/clients without token", async () => {
      const res = await app.request("/api/clients");
      expect(res.status).toBe(401);
    });

    it("should return 401 on POST /api/clients without token", async () => {
      const res = await app.request("/api/clients", {
        method: "POST",
        body: JSON.stringify(basePayload),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/clients ───────────────────────────────────────────

  describe("POST /api/clients", () => {
    it("should create a client and return 201", async () => {
      const res = await post(basePayload);
      const body = (await res.json()) as {
        success: boolean;
        data: {
          id: number;
          name: string;
          document: string;
          clientType: string;
        };
      };

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("João Silva");
      expect(body.data.document).toBe("123.456.789-00");
      expect(body.data.clientType).toBe("COUNTER");
    });

    it("should create a client with optional fields", async () => {
      const res = await post({
        ...basePayload,
        phone: "(11) 91234-5678",
        address: "Rua das Flores, 123",
      });
      const body = (await res.json()) as {
        data: { phone: string; address: string };
      };

      expect(res.status).toBe(201);
      expect(body.data.phone).toBe("(11) 91234-5678");
      expect(body.data.address).toBe("Rua das Flores, 123");
    });

    it("should return 400 when name is missing", async () => {
      const res = await post({
        document: "123.456.789-00",
        clientType: "COUNTER",
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 when clientType is invalid", async () => {
      const res = await post({ ...basePayload, clientType: "INVALID" });
      expect(res.status).toBe(400);
    });

    it("should return 409 when document is already in use", async () => {
      await post(basePayload);
      const res = await post({ ...basePayload, name: "Outro Nome" });
      expect(res.status).toBe(409);
    });
  });

  // ─── GET /api/clients ────────────────────────────────────────────

  describe("GET /api/clients", () => {
    it("should return paginated client list", async () => {
      await post(basePayload);
      await post({
        name: "Maria Souza",
        document: "987.654.321-00",
        clientType: "PARTNER",
      });

      const res = await app.request("/api/clients", { headers: authHeader() });
      const body = (await res.json()) as {
        success: boolean;
        data: {
          clients: unknown[];
          pagination: { total: number };
        };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.clients.length).toBe(2);
      expect(body.data.pagination.total).toBe(2);
    });

    it("should filter by clientType", async () => {
      await post(basePayload);
      await post({
        name: "Maria Souza",
        document: "987.654.321-00",
        clientType: "PARTNER",
      });

      const res = await app.request("/api/clients?clientType=COUNTER", {
        headers: authHeader(),
      });
      const body = (await res.json()) as {
        data: { clients: Array<{ clientType: string }> };
      };

      expect(res.status).toBe(200);
      expect(body.data.clients.length).toBe(1);
      expect(body.data.clients[0]?.clientType).toBe("COUNTER");
    });

    it("should search by name", async () => {
      await post(basePayload);
      await post({
        name: "Maria Souza",
        document: "987.654.321-00",
        clientType: "PARTNER",
      });

      const res = await app.request("/api/clients?search=Maria", {
        headers: authHeader(),
      });
      const body = (await res.json()) as {
        data: { clients: Array<{ name: string }> };
      };

      expect(res.status).toBe(200);
      expect(body.data.clients.length).toBe(1);
      expect(body.data.clients[0]?.name).toBe("Maria Souza");
    });

    it("should respect pagination params", async () => {
      await post(basePayload);
      await post({
        name: "Maria Souza",
        document: "987.654.321-00",
        clientType: "PARTNER",
      });

      const res = await app.request("/api/clients?page=1&limit=1", {
        headers: authHeader(),
      });
      const body = (await res.json()) as {
        data: {
          clients: unknown[];
          pagination: { total: number; totalPages: number };
        };
      };

      expect(res.status).toBe(200);
      expect(body.data.clients.length).toBe(1);
      expect(body.data.pagination.total).toBe(2);
      expect(body.data.pagination.totalPages).toBe(2);
    });
  });

  // ─── GET /api/clients/:id ────────────────────────────────────────

  describe("GET /api/clients/:id", () => {
    it("should return a client with their orders array", async () => {
      const created = (await (await post(basePayload)).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/clients/${created.data.id}`, {
        headers: authHeader(),
      });
      const body = (await res.json()) as {
        success: boolean;
        data: { id: number; orders: unknown[] };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(created.data.id);
      expect(Array.isArray(body.data.orders)).toBe(true);
    });

    it("should return 404 for a non-existent id", async () => {
      const res = await app.request("/api/clients/999999", {
        headers: authHeader(),
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /api/clients/:id ────────────────────────────────────────

  describe("PUT /api/clients/:id", () => {
    it("should update a client and return 200", async () => {
      const created = (await (await post(basePayload)).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/clients/${created.data.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: "Nome Atualizado" }),
        headers: { "Content-Type": "application/json", ...authHeader() },
      });
      const body = (await res.json()) as { data: { name: string } };

      expect(res.status).toBe(200);
      expect(body.data.name).toBe("Nome Atualizado");
    });

    it("should return 404 when updating a non-existent client", async () => {
      const res = await app.request("/api/clients/999999", {
        method: "PUT",
        body: JSON.stringify({ name: "Qualquer" }),
        headers: { "Content-Type": "application/json", ...authHeader() },
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/clients/:id ─────────────────────────────────────

  describe("DELETE /api/clients/:id", () => {
    it("should delete a client and return 200", async () => {
      const created = (await (await post(basePayload)).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/clients/${created.data.id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      const body = (await res.json()) as { success: boolean };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("should return 404 when deleting a non-existent client", async () => {
      const res = await app.request("/api/clients/999999", {
        method: "DELETE",
        headers: authHeader(),
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should return 400 on GET with a non-numeric id", async () => {
      const res = await app.request("/api/clients/abc", {
        headers: authHeader(),
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 on PUT with a non-numeric id", async () => {
      const res = await app.request("/api/clients/abc", {
        method: "PUT",
        body: JSON.stringify({ name: "Qualquer" }),
        headers: { "Content-Type": "application/json", ...authHeader() },
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 on DELETE with a non-numeric id", async () => {
      const res = await app.request("/api/clients/abc", {
        method: "DELETE",
        headers: authHeader(),
      });
      expect(res.status).toBe(400);
    });

    it("should return 409 when deleting a client that has linked orders", async () => {
      const created = (await (await post(basePayload)).json()) as {
        data: { id: number };
      };

      // assignedUserId is nullable, so an order needs only a clientId.
      await prisma.serviceOrder.create({
        data: {
          orderNumber: "OS-DEL-1",
          description: "linked order",
          value: "10.00",
          clientId: created.data.id,
          companyId,
        },
      });

      const res = await app.request(`/api/clients/${created.data.id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      expect(res.status).toBe(409);
    });
  });

  // ─── Security headers ─────────────────────────────────────────────

  describe("security headers", () => {
    it("should include X-Content-Type-Options: nosniff", async () => {
      const res = await app.request("/api/clients");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });
  });
});
