import { describe, it, expect, beforeEach } from "bun:test";
import { ClientService } from "../client-service";
import prisma from "../../../db/client";

const clientService = new ClientService();

const baseClient = {
  name: "João Silva",
  document: "123.456.789-00",
  clientType: "COUNTER" as const,
};

describe("ClientService", () => {
  beforeEach(async () => {
    await prisma.client.deleteMany();
  });

  describe("create", () => {
    it("should create a client and return it", async () => {
      const client = await clientService.create(baseClient);

      expect(client).toHaveProperty("id");
      expect(client.name).toBe("João Silva");
      expect(client.document).toBe("123.456.789-00");
      expect(client.clientType).toBe("COUNTER");
      expect(client.phone).toBeNull();
      expect(client.address).toBeNull();
    });

    it("should create a client with optional fields", async () => {
      const client = await clientService.create({
        ...baseClient,
        phone: "(11) 91234-5678",
        address: "Rua das Flores, 123",
      });

      expect(client.phone).toBe("(11) 91234-5678");
      expect(client.address).toBe("Rua das Flores, 123");
    });
  });

  describe("getAll", () => {
    it("should return all clients with pagination metadata", async () => {
      await clientService.create(baseClient);
      await clientService.create({
        name: "Maria Souza",
        document: "987.654.321-00",
        clientType: "PARTNER",
      });

      const result = await clientService.getAll();

      expect(result.clients.length).toBe(2);
      expect(result.pagination.total).toBe(2);
    });

    it("should return correct pagination metadata", async () => {
      await clientService.create(baseClient);
      await clientService.create({
        name: "Maria Souza",
        document: "987.654.321-00",
        clientType: "PARTNER",
      });

      const result = await clientService.getAll("1", "1");

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it("should filter by clientType", async () => {
      await clientService.create(baseClient);
      await clientService.create({
        name: "Maria Souza",
        document: "987.654.321-00",
        clientType: "PARTNER",
      });

      const result = await clientService.getAll(
        undefined,
        undefined,
        "COUNTER",
      );

      expect(result.clients.length).toBe(1);
      expect(result.clients[0]?.clientType).toBe("COUNTER");
    });

    it("should search by name (case-insensitive)", async () => {
      await clientService.create(baseClient);
      await clientService.create({
        name: "Maria Souza",
        document: "987.654.321-00",
        clientType: "PARTNER",
      });

      const result = await clientService.getAll(
        undefined,
        undefined,
        undefined,
        "joão",
      );

      expect(result.clients.length).toBe(1);
      expect(result.clients[0]?.name).toBe("João Silva");
    });

    it("should search by document", async () => {
      await clientService.create(baseClient);
      await clientService.create({
        name: "Maria Souza",
        document: "987.654.321-00",
        clientType: "PARTNER",
      });

      const result = await clientService.getAll(
        undefined,
        undefined,
        undefined,
        "987",
      );

      expect(result.clients.length).toBe(1);
      expect(result.clients[0]?.document).toBe("987.654.321-00");
    });
  });

  describe("findById", () => {
    it("should return a client with their orders", async () => {
      const created = await clientService.create(baseClient);
      const found = await clientService.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(Array.isArray(found?.orders)).toBe(true);
    });

    it("should return null for a non-existent id", async () => {
      const found = await clientService.findById(999999);

      expect(found).toBeNull();
    });
  });

  describe("update", () => {
    it("should update client fields", async () => {
      const created = await clientService.create(baseClient);
      const updated = await clientService.update(created.id, {
        name: "João Atualizado",
        phone: "(11) 99999-9999",
      });

      expect(updated.name).toBe("João Atualizado");
      expect(updated.phone).toBe("(11) 99999-9999");
      expect(updated.document).toBe(baseClient.document);
    });
  });

  describe("delete", () => {
    it("should delete a client", async () => {
      const created = await clientService.create(baseClient);
      await clientService.delete(created.id);

      const found = await clientService.findById(created.id);
      expect(found).toBeNull();
    });
  });
});
