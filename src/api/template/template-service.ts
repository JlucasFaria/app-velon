import prismaClient from "../../db/client";
import type { PrismaClient } from "../../../generated/prisma";
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateItemInput,
} from "./template-schema";

const ITEMS_SELECT = {
  id: true,
  description: true,
  category: true,
  suggestedValue: true,
  quantity: true,
} as const;

const TEMPLATE_SELECT = {
  id: true,
  name: true,
  defaultDescription: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: ITEMS_SELECT,
    orderBy: { id: "asc" as const },
  },
} as const;

function buildItemCreateData(item: TemplateItemInput) {
  return {
    description: item.description,
    category: item.category ?? null,
    suggestedValue: item.suggestedValue,
    quantity: item.quantity ?? null,
  };
}

export class TemplateService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async create(data: CreateTemplateInput, companyId: number) {
    return await this.prisma.serviceTemplate.create({
      data: {
        name: data.name,
        defaultDescription: data.defaultDescription,
        companyId,
        items: {
          create: data.items.map(buildItemCreateData),
        },
      },
      select: TEMPLATE_SELECT,
    });
  }

  async getAll(companyId: number) {
    return await this.prisma.serviceTemplate.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: TEMPLATE_SELECT,
    });
  }

  async findById(id: number, companyId: number) {
    return await this.prisma.serviceTemplate.findFirst({
      where: { id, companyId },
      select: TEMPLATE_SELECT,
    });
  }

  // Returns null when the template does not exist or belongs to another
  // company, so the route can answer 404 without leaking cross-tenant existence.
  async update(id: number, companyId: number, data: UpdateTemplateInput) {
    const owned = await this.prisma.serviceTemplate.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!owned) return null;

    // Items are replaced wholesale when provided, mirroring order updates.
    if (data.items !== undefined) {
      const newItems = data.items;
      return await this.prisma.$transaction(async (tx) => {
        await tx.serviceTemplateItem.deleteMany({ where: { templateId: id } });
        return await tx.serviceTemplate.update({
          where: { id },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.defaultDescription !== undefined
              ? { defaultDescription: data.defaultDescription }
              : {}),
            items: {
              create: newItems.map(buildItemCreateData),
            },
          },
          select: TEMPLATE_SELECT,
        });
      });
    }

    return await this.prisma.serviceTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.defaultDescription !== undefined
          ? { defaultDescription: data.defaultDescription }
          : {}),
      },
      select: TEMPLATE_SELECT,
    });
  }

  async delete(id: number, companyId: number) {
    const owned = await this.prisma.serviceTemplate.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!owned) return null;

    return await this.prisma.serviceTemplate.delete({
      where: { id },
    });
  }
}
