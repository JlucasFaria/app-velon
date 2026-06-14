import prismaClient from "../../db/client";
import type { PrismaClient } from "../../../generated/prisma";
import type { CreatePartnerInput } from "./partner-schema";

const PARTNER_SELECT = {
  id: true,
  name: true,
  companyId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PartnerService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async getAll(companyId: number, q?: string) {
    return await this.prisma.partner.findMany({
      where: {
        companyId,
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      },
      select: PARTNER_SELECT,
      orderBy: { name: "asc" },
    });
  }

  async create(companyId: number, data: CreatePartnerInput) {
    return await this.prisma.partner.create({
      data: { name: data.name, companyId },
      select: PARTNER_SELECT,
    });
  }
}
