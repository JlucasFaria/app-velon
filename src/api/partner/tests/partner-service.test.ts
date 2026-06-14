import { describe, it, expect } from "bun:test";
import { PartnerService } from "../partner-service";
import prisma from "../../../db/client";
import { createTestCompany } from "../../../test-utils/company";

const partnerService = new PartnerService();

describe("PartnerService", () => {
  describe("getAll", () => {
    it("should return all partners for the company", async () => {
      const companyId = await createTestCompany();
      const prefix = crypto.randomUUID().slice(0, 8);
      await prisma.partner.create({
        data: { name: `${prefix}-Alpha`, companyId },
      });
      await prisma.partner.create({
        data: { name: `${prefix}-Beta`, companyId },
      });

      const result = await partnerService.getAll(companyId);

      const owned = result.filter((p) => p.name.startsWith(prefix));
      expect(owned.length).toBe(2);
    });

    it("should filter by name (case-insensitive, partial match)", async () => {
      const companyId = await createTestCompany();
      const prefix = crypto.randomUUID().slice(0, 8);
      await prisma.partner.create({
        data: { name: `${prefix}-Alpha Corp`, companyId },
      });
      await prisma.partner.create({
        data: { name: `${prefix}-Beta Ltda`, companyId },
      });

      const result = await partnerService.getAll(companyId, "alpha");

      const owned = result.filter((p) => p.name.startsWith(prefix));
      expect(owned.length).toBe(1);
      expect(owned[0]?.name).toContain("Alpha Corp");
    });

    it("should not return partners from another company", async () => {
      const companyId = await createTestCompany();
      const otherCompanyId = await createTestCompany("Other Co");
      await prisma.partner.create({
        data: { name: `isolated-${crypto.randomUUID()}`, companyId },
      });
      await prisma.partner.create({
        data: {
          name: `other-${crypto.randomUUID()}`,
          companyId: otherCompanyId,
        },
      });

      const result = await partnerService.getAll(companyId);

      expect(result.every((p) => p.companyId === companyId)).toBe(true);
    });

    it("should return partners ordered by name ascending", async () => {
      const companyId = await createTestCompany();
      const prefix = crypto.randomUUID().slice(0, 8);
      await prisma.partner.create({
        data: { name: `${prefix}-Zeta`, companyId },
      });
      await prisma.partner.create({
        data: { name: `${prefix}-Alpha`, companyId },
      });

      const result = await partnerService.getAll(companyId);

      const names = result
        .filter((p) => p.name.startsWith(prefix))
        .map((p) => p.name);
      expect(names).toEqual([...names].sort());
    });
  });

  describe("create", () => {
    it("should create and return a partner with the correct fields", async () => {
      const companyId = await createTestCompany();
      const name = `Partner-${crypto.randomUUID()}`;

      const partner = await partnerService.create(companyId, { name });

      expect(partner.id).toBeDefined();
      expect(partner.name).toBe(name);
      expect(partner.companyId).toBe(companyId);
      expect(partner.createdAt).toBeDefined();
      expect(partner.updatedAt).toBeDefined();
    });

    it("should throw on duplicate name within the same company", async () => {
      const companyId = await createTestCompany();
      const name = `DupPartner-${crypto.randomUUID()}`;
      await partnerService.create(companyId, { name });

      let threw = false;
      try {
        await partnerService.create(companyId, { name });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });

    it("should allow the same name in different companies", async () => {
      const companyIdA = await createTestCompany("Co A");
      const companyIdB = await createTestCompany("Co B");
      const name = `Shared-${crypto.randomUUID()}`;

      const a = await partnerService.create(companyIdA, { name });
      const b = await partnerService.create(companyIdB, { name });

      expect(a.name).toBe(name);
      expect(b.name).toBe(name);
      expect(a.companyId).not.toBe(b.companyId);
    });
  });
});
