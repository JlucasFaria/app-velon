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

    it("should assign registrationNumber 1 to the first client", async () => {
      const client = await clientService.create(baseClient, companyId);
      expect(client.registrationNumber).toBe(1);
    });

    it("should increment registrationNumber sequentially within the same company", async () => {
      const first = await clientService.create(baseClient, companyId);
      const second = await clientService.create(
        { name: "Maria Souza", document: "987.654.321-00", clientType: "COUNTER" as const },
        companyId,
      );
      expect(first.registrationNumber).toBe(1);
      expect(second.registrationNumber).toBe(2);
    });

    it("should scope registrationNumber per company — each company starts at 1", async () => {
      const otherCompanyId = await createTestCompany("Other Co");
      const clientA = await clientService.create(baseClient, companyId);
      const clientB = await clientService.create(
        { name: "Maria Souza", document: "987.654.321-00", clientType: "COUNTER" as const },
        otherCompanyId,
      );
      expect(clientA.registrationNumber).toBe(1);
      expect(clientB.registrationNumber).toBe(1);
    });

    it("should ignore clients with a null registrationNumber when computing the next number", async () => {
      // Simulate an out-of-band insert (seed/import) that skipped the service
      // and left registrationNumber null. MAX must skip it, not reset to 1.
      await clientService.create(baseClient, companyId);
      await prisma.client.create({
        data: {
          name: "Importado",
          document: "987.654.321-00",
          clientType: "COUNTER",
          companyId,
        },
      });

      const next = await clientService.create(
        { name: "Pedro Lima", document: "111.222.333-44", clientType: "COUNTER" as const },
        companyId,
      );

      expect(next.registrationNumber).toBe(2);
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

    it("should clear partner when clientType changes from PARTNER to COUNTER", async () => {
      const partnerEntity = await prisma.partner.create({
        data: { name: "Parceiro Original", companyId },
      });
      const partnerClient = await clientService.create(
        {
          name: "Empresa Parceira",
          document: "99999999999999",
          clientType: "PARTNER" as const,
          partnerId: partnerEntity.id,
        },
        companyId,
      );

      expect(partnerClient.partner?.name).toBe("Parceiro Original");

      const updated = await clientService.update(partnerClient.id, companyId, {
        clientType: "COUNTER",
      });

      expect(updated?.clientType).toBe("COUNTER");
      expect(updated?.partner).toBeNull();
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

  describe("search", () => {
    it("should return clients matching the name (case-insensitive)", async () => {
      await clientService.create(baseClient, companyId);
      await clientService.create(
        { name: "Maria Souza", document: "98765432100", clientType: "COUNTER" as const },
        companyId,
      );

      const results = await clientService.search(companyId, "joão");

      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe("João Silva");
    });

    it("should return id, name, document and clientType fields only", async () => {
      await clientService.create(baseClient, companyId);

      const results = await clientService.search(companyId, "João");

      expect(results[0]).toHaveProperty("id");
      expect(results[0]).toHaveProperty("name");
      expect(results[0]).toHaveProperty("document");
      expect(results[0]).toHaveProperty("clientType");
      expect(results[0]).not.toHaveProperty("phone");
      expect(results[0]).not.toHaveProperty("partner");
    });

    it("should return at most 5 results", async () => {
      for (let i = 1; i <= 6; i++) {
        await clientService.create(
          {
            name: `Teste Busca ${i}`,
            document: String(i).padStart(11, "0"),
            clientType: "COUNTER" as const,
          },
          companyId,
        );
      }

      const results = await clientService.search(companyId, "Teste Busca");

      expect(results.length).toBe(5);
    });

    it("should not return clients from another company", async () => {
      await clientService.create(baseClient, companyId);
      const otherCompanyId = await createTestCompany("Other Co Search");
      await clientService.create(
        { name: "João Outro", document: "98765432100", clientType: "COUNTER" as const },
        otherCompanyId,
      );

      const results = await clientService.search(companyId, "João");

      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe("João Silva");
    });
  });

  describe("getPartnerNameSuggestions", () => {
    it("should return distinct partner names", async () => {
      await prisma.partner.create({ data: { name: "Alpha Ltda", companyId } });
      await prisma.partner.create({ data: { name: "Beta Corp", companyId } });

      const names = await clientService.getPartnerNameSuggestions(companyId);

      expect(names).toContain("Alpha Ltda");
      expect(names).toContain("Beta Corp");
      expect(names.filter((n) => n === "Alpha Ltda").length).toBe(1);
    });

    it("should filter by q when provided", async () => {
      await prisma.partner.create({ data: { name: "Alpha Ltda", companyId } });
      await prisma.partner.create({ data: { name: "Beta Corp", companyId } });

      const names = await clientService.getPartnerNameSuggestions(companyId, "Alpha");

      expect(names).toContain("Alpha Ltda");
      expect(names).not.toContain("Beta Corp");
    });

    it("should return all partner entities for the company", async () => {
      await clientService.create(baseClient, companyId);
      await prisma.partner.create({ data: { name: "Meu Parceiro", companyId } });

      const names = await clientService.getPartnerNameSuggestions(companyId);

      expect(names.length).toBe(1);
      expect(names[0]).toBe("Meu Parceiro");
    });

    it("should not return names from another company", async () => {
      await prisma.partner.create({ data: { name: "Meu Parceiro", companyId } });
      const otherCompanyId = await createTestCompany("Other Co Names");
      await prisma.partner.create({ data: { name: "Outro Parceiro", companyId: otherCompanyId } });

      const names = await clientService.getPartnerNameSuggestions(companyId);

      expect(names).toContain("Meu Parceiro");
      expect(names).not.toContain("Outro Parceiro");
    });
  });
});
