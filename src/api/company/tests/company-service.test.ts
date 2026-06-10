import { describe, it, expect, beforeEach } from "bun:test";
import { CompanyService } from "../company-service";
import { createTestCompany } from "../../../test-utils/company";

const service = new CompanyService();

describe("CompanyService", () => {
  let companyId: number;

  beforeEach(async () => {
    companyId = await createTestCompany("Acme Ltda");
  });

  describe("findById", () => {
    it("should return the company by id", async () => {
      const company = await service.findById(companyId);

      expect(company).not.toBeNull();
      expect(company?.id).toBe(companyId);
      expect(company?.name).toBe("Acme Ltda");
      expect(company?.logoUrl).toBeNull();
    });

    it("should return null for a non-existent id", async () => {
      expect(await service.findById(999999)).toBeNull();
    });
  });

  describe("update", () => {
    it("should update editable fields", async () => {
      const company = await service.update(companyId, {
        name: "Acme S.A.",
        document: "12.345.678/0001-90",
        phone: "(11) 1111-2222",
        email: "contato@acme.com",
        address: "Rua A, 1",
        footerNote: "Garantia de 90 dias.",
      });

      expect(company.name).toBe("Acme S.A.");
      expect(company.document).toBe("12.345.678/0001-90");
      expect(company.phone).toBe("(11) 1111-2222");
      expect(company.email).toBe("contato@acme.com");
      expect(company.address).toBe("Rua A, 1");
      expect(company.footerNote).toBe("Garantia de 90 dias.");
    });
  });

  describe("updateLogo", () => {
    it("should persist the logo url", async () => {
      const company = await service.updateLogo(
        companyId,
        "/api/uploads/logos/company-1.png",
      );

      expect(company.logoUrl).toBe("/api/uploads/logos/company-1.png");
    });
  });
});
