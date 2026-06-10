import { describe, it, expect, beforeEach } from "bun:test";
import { ClientService } from "../client-service";
import prisma from "../../../db/client";
import { createTestCompany } from "../../../test-utils/company";

const clientService = new ClientService();

const baseClient = {
  name: "João Silva",
  document: "123.456.789-00",
  clientType: "COUNTER" as const,
};

describe("ClientService", () => {
  let companyId: number;

  beforeEach(async () => {
    await prisma.client.deleteMany();
    companyId = await createTestCompany();
  });

  describe("create", () => {
    it("should create a client and return it", async () => {
      const client = await clientService.create(baseClient, companyId);

      expect(client).toHaveProperty("id");
      expect(client.name).toBe("João Silva");
      expect(client.document).toBe("123.456.789-00");
      expect(client.clientType).toBe("COUNTER");
      expect(client.phone).toBeNull();
      expect(client.address).toBeNull();
    });

    it("should create a client with optional fields", async () => {
      const client = await clientService.create(
        {
          ...baseClient,
          phone: "(11) 91234-5678",
          address: "Rua das Flores, 123",
        },
        companyId,
      );

      expect(client.phone).toBe("(11) 91234-5678");
      expect(client.address).toBe("Rua das Flores, 123");
    });
  });

  describe("getAll", () => {
    it("should return all clients with pagination metadata", async () => {
      await clientService.create(baseClient, companyId);
      await clientService.create(
        {
          name: "Maria Souza",
          document: "987.654.321-00",
          clientType: "PARTNER",
        },
        companyId,
      );

      const result = await clientService.getAll(companyId);

      expect(result.clients.length).toBe(2);
      expect(result.pagination.total).toBe(2);
    });

    it("should return correct pagination metadata", async () => {
      await clientService.create(baseClient, companyId);
      await clientService.create(
        {
          name: "Maria Souza",
          document: "987.654.321-00",
          clientType: "PARTNER",
        },
        companyId,
      );

      const result = await clientService.getAll(companyId, "1", "1");

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it("should filter by clientType", async () => {
      await clientService.create(baseClient, companyId);
      await clientService.create(
        {
          name: "Maria Souza",
          document: "987.654.321-00",
          clientType: "PARTNER",
        },
        companyId,
      );

      const result = await clientService.getAll(
        companyId,
        undefined,
        undefined,
        "COUNTER",
      );

      expect(result.clients.length).toBe(1);
      expect(result.clients[0]?.clientType).toBe("COUNTER");
    });

    it("should search by name (case-insensitive)", async () => {
      await clientService.create(baseClient, companyId);
      await clientService.create(
        {
          name: "Maria Souza",
          document: "987.654.321-00",
          clientType: "PARTNER",
        },
        companyId,
      );

      const result = await clientService.getAll(
        companyId,
        undefined,
        undefined,
        undefined,
        "joão",
      );

      expect(result.clients.length).toBe(1);
      expect(result.clients[0]?.name).toBe("João Silva");
    });

    it("should search by document", async () => {
      await clientService.create(baseClient, companyId);
      await clientService.create(
        {
          name: "Maria Souza",
          document: "987.654.321-00",
          clientType: "PARTNER",
        },
        companyId,
      );

      const result = await clientService.getAll(
        companyId,
        undefined,
        undefined,
        undefined,
        "987",
      );

      expect(result.clients.length).toBe(1);
      expect(result.clients[0]?.document).toBe("987.654.321-00");
    });

    it("should not return clients from another company", async () => {
      await clientService.create(baseClient, companyId);
      const otherCompanyId = await createTestCompany("Other Company");
      await clientService.create(
        {
          name: "Maria Souza",
          document: "987.654.321-00",
          clientType: "PARTNER",
        },
        otherCompanyId,
      );

      const result = await clientService.getAll(companyId);

      expect(result.clients.length).toBe(1);
      expect(result.clients[0]?.name).toBe("João Silva");
    });
  });

  describe("findById", () => {
    it("should return a client with their orders", async () => {
      const created = await clientService.create(baseClient, companyId);
      const found = await clientService.findById(created.id, companyId);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(Array.isArray(found?.orders)).toBe(true);
    });

    it("should return null for a non-existent id", async () => {
      const found = await clientService.findById(999999, companyId);

      expect(found).toBeNull();
    });

    it("should return null for a client owned by another company", async () => {
      const created = await clientService.create(baseClient, companyId);
      const otherCompanyId = await createTestCompany("Other Company");

      const found = await clientService.findById(created.id, otherCompanyId);

      expect(found).toBeNull();
    });
  });

  describe("update", () => {
    it("should update client fields", async () => {
      const created = await clientService.create(baseClient, companyId);
      const updated = await clientService.update(created.id, companyId, {
        name: "João Atualizado",
        phone: "(11) 99999-9999",
      });

      expect(updated?.name).toBe("João Atualizado");
      expect(updated?.phone).toBe("(11) 99999-9999");
      expect(updated?.document).toBe(baseClient.document);
    });

    it("should return null when updating a client from another company", async () => {
      const created = await clientService.create(baseClient, companyId);
      const otherCompanyId = await createTestCompany("Other Company");

      const updated = await clientService.update(created.id, otherCompanyId, {
        name: "Hacked",
      });

      expect(updated).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete a client", async () => {
      const created = await clientService.create(baseClient, companyId);
      await clientService.delete(created.id, companyId);

      const found = await clientService.findById(created.id, companyId);
      expect(found).toBeNull();
    });

    it("should return null when deleting a client from another company", async () => {
      const created = await clientService.create(baseClient, companyId);
      const otherCompanyId = await createTestCompany("Other Company");

      const deleted = await clientService.delete(created.id, otherCompanyId);
      expect(deleted).toBeNull();

      // The client must still exist for its real owner.
      const found = await clientService.findById(created.id, companyId);
      expect(found).not.toBeNull();
    });
  });
});
