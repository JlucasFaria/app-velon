import prismaClient from "../../db/client";
import type { PrismaClient } from "../../../generated/prisma";
import type { UpdateCompanyInput, CreateCompanyInput } from "./company-schema";

const COMPANY_SELECT = {
  id: true,
  name: true,
  document: true,
  phone: true,
  email: true,
  address: true,
  logoUrl: true,
  footerNote: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class CompanyService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async findById(companyId: number) {
    return await this.prisma.company.findUnique({
      where: { id: companyId },
      select: COMPANY_SELECT,
    });
  }

  async update(companyId: number, data: UpdateCompanyInput) {
    return await this.prisma.company.update({
      where: { id: companyId },
      data,
      select: COMPANY_SELECT,
    });
  }

  // Creates a company and assigns the requesting user as ADMIN/ACTIVE owner.
  // Runs inside a transaction so partial writes never occur.
  async createWithOwner(userId: number, data: CreateCompanyInput) {
    return await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data,
        select: COMPANY_SELECT,
      });
      await tx.membership.create({
        data: {
          userId,
          companyId: company.id,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      return company;
    });
  }

  // Used by the logo upload endpoint to persist the stored file path.
  async updateLogo(companyId: number, logoUrl: string) {
    return await this.prisma.company.update({
      where: { id: companyId },
      data: { logoUrl },
      select: COMPANY_SELECT,
    });
  }
}
