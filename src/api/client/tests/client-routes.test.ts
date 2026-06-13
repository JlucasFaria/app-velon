import { describe, it, expect, beforeEach } from "bun:test";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import { signTestToken, createTestCompany } from "../../../test-utils/company";

describe("Client Routes", () => {
  let token: string;
  let companyId: number;

  // Dedicated IP so this file's requests use their own rate-limit bucket,
  // isolated from other test files sharing the "unknown" bucket.
  const IP = "127.0.0.21";

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

  const authHeader = () => ({
    Authorization: `Bearer ${token}`,
    "X-Forwarded-For": IP,
  });

  const post = (body: object) =>
    app.request("/api/clients", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", ...authHeader() },
    });

  // ─── Auth guard ──────────────────────────────────────────────────

  describe("auth guard", () => {
    it("should return 401 on GET /api/clients without token", async () => {
      const res = await app.request("/api/clients", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 401 on POST /api/clients without token", async () => {
      const res = await app.request("/api/clients", {
        method: "POST",
        body: JSON.stringify(basePayload),
        headers: { "Content-Type": "application/json", "X-Forwarded-For": IP },
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
          registrationNumber: number;
        };
      };

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("João Silva");
      expect(body.data.document).toBe("123.456.789-00");
      expect(body.data.clientType).toBe("COUNTER");
      expect(body.data.registrationNumber).toBe(1);
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
        partnerName: "Parceiro XYZ",
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
        partnerName: "Parceiro XYZ",
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
        partnerName: "Parceiro XYZ",
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
        partnerName: "Parceiro XYZ",
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

    it("should filter by partnerName (case-insensitive, partial match)", async () => {
      await post({
        name: "Empresa Alpha",
        document: "11111111111111",
        clientType: "PARTNER",
        partnerName: "Alpha Partner",
      });
      await post({
        name: "Empresa Beta",
        document: "22222222222222",
        clientType: "PARTNER",
        partnerName: "Beta Partner",
      });
      await post(basePayload); // COUNTER, no partner

      const res = await app.request("/api/clients?partnerName=alpha", {
        headers: authHeader(),
      });
      const body = (await res.json()) as {
        data: { clients: Array<{ partnerName: string | null }> };
      };

      expect(res.status).toBe(200);
      expect(body.data.clients.length).toBe(1);
      expect(body.data.clients[0]?.partnerName).toBe("Alpha Partner");
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

  // ─── partnerName validation ───────────────────────────────────────

  describe("partnerName validation", () => {
    it("should return 400 when clientType is PARTNER and partnerName is missing", async () => {
      const res = await post({
        name: "Empresa Parceira",
        document: "12345678000100",
        clientType: "PARTNER",
      });
      expect(res.status).toBe(400);
    });

    it("should return 201 when clientType is PARTNER and partnerName is provided", async () => {
      const res = await post({
        name: "Empresa Parceira",
        document: "12345678000100",
        clientType: "PARTNER",
        partnerName: "Parceiro XYZ",
      });
      expect(res.status).toBe(201);
    });

    it("should return 400 on PUT when changing to PARTNER without partnerName", async () => {
      const created = (await (await post(basePayload)).json()) as {
        data: { id: number };
      };

      const res = await app.request(`/api/clients/${created.data.id}`, {
        method: "PUT",
        body: JSON.stringify({ clientType: "PARTNER" }),
        headers: { "Content-Type": "application/json", ...authHeader() },
      });
      expect(res.status).toBe(400);
    });

    it("should return 409 with pt-BR message when document is duplicate", async () => {
      await post(basePayload);
      const res = await post({ ...basePayload, name: "Outro Nome" });
      const body = (await res.json()) as { success: boolean; error: string };

      expect(res.status).toBe(409);
      expect(body.error).toBe("Documento já cadastrado nesta empresa");
    });
  });

  // ─── GET /api/clients/search ──────────────────────────────────────

  describe("GET /api/clients/search", () => {
    it("should return 401 without token", async () => {
      const res = await app.request("/api/clients/search?q=João", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 400 when q has fewer than 3 characters", async () => {
      const res = await app.request("/api/clients/search?q=Jo", {
        headers: authHeader(),
      });
      expect(res.status).toBe(400);
    });

    it("should return matching clients by name (case-insensitive)", async () => {
      await post(basePayload);
      await post({
        name: "Maria Souza",
        document: "98765432100",
        clientType: "COUNTER",
      });

      const res = await app.request("/api/clients/search?q=jo%C3%A3o", {
        headers: authHeader(),
      });
      const body = (await res.json()) as {
        success: boolean;
        data: Array<{ name: string; document: string; clientType: string }>;
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(1);
      expect(body.data[0]?.name).toBe("João Silva");
    });

    it("should return at most 5 results", async () => {
      for (let i = 1; i <= 6; i++) {
        await post({
          name: `Teste Busca ${i}`,
          document: String(i).padStart(11, "0"),
          clientType: "COUNTER",
        });
      }

      const res = await app.request(
        "/api/clients/search?q=Teste+Busca",
        { headers: authHeader() },
      );
      const body = (await res.json()) as { data: unknown[] };

      expect(res.status).toBe(200);
      expect(body.data.length).toBe(5);
    });

    it("should not return clients from another company", async () => {
      await post(basePayload);
      const otherCompanyId = await createTestCompany("Other Co Search");
      await prisma.client.create({
        data: {
          name: "João Outro",
          document: "98765432100",
          clientType: "COUNTER",
          companyId: otherCompanyId,
        },
      });

      const res = await app.request("/api/clients/search?q=Jo%C3%A3o", {
        headers: authHeader(),
      });
      const body = (await res.json()) as { data: Array<{ name: string }> };

      expect(res.status).toBe(200);
      expect(body.data.length).toBe(1);
      expect(body.data[0]?.name).toBe("João Silva");
    });
  });

  // ─── GET /api/clients/partner-names ──────────────────────────────

  describe("GET /api/clients/partner-names", () => {
    it("should return 401 without token", async () => {
      const res = await app.request("/api/clients/partner-names", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return distinct partner names", async () => {
      await post({ name: "Empresa A", document: "11111111111111", clientType: "PARTNER", partnerName: "Alpha Ltda" });
      await post({ name: "Empresa B", document: "22222222222222", clientType: "PARTNER", partnerName: "Alpha Ltda" });
      await post({ name: "Empresa C", document: "33333333333333", clientType: "PARTNER", partnerName: "Beta Corp" });

      const res = await app.request("/api/clients/partner-names", {
        headers: authHeader(),
      });
      const body = (await res.json()) as { success: boolean; data: string[] };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toContain("Alpha Ltda");
      expect(body.data).toContain("Beta Corp");
      expect(body.data.filter((n) => n === "Alpha Ltda").length).toBe(1);
    });

    it("should filter by q when provided", async () => {
      await post({ name: "Empresa A", document: "11111111111111", clientType: "PARTNER", partnerName: "Alpha Ltda" });
      await post({ name: "Empresa B", document: "22222222222222", clientType: "PARTNER", partnerName: "Beta Corp" });

      const res = await app.request("/api/clients/partner-names?q=Alpha", {
        headers: authHeader(),
      });
      const body = (await res.json()) as { data: string[] };

      expect(res.status).toBe(200);
      expect(body.data).toContain("Alpha Ltda");
      expect(body.data).not.toContain("Beta Corp");
    });

    it("should not return names from another company", async () => {
      await post({ name: "Empresa A", document: "11111111111111", clientType: "PARTNER", partnerName: "Meu Parceiro" });
      const otherCompanyId = await createTestCompany("Other Co Names");
      await prisma.client.create({
        data: {
          name: "Empresa X",
          document: "22222222222222",
          clientType: "PARTNER",
          partnerName: "Outro Parceiro",
          companyId: otherCompanyId,
        },
      });

      const res = await app.request("/api/clients/partner-names", {
        headers: authHeader(),
      });
      const body = (await res.json()) as { data: string[] };

      expect(res.status).toBe(200);
      expect(body.data).toContain("Meu Parceiro");
      expect(body.data).not.toContain("Outro Parceiro");
    });
  });

  // ─── Security headers ─────────────────────────────────────────────

  describe("security headers", () => {
    it("should include X-Content-Type-Options: nosniff", async () => {
      const res = await app.request("/api/clients", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });
  });
});
