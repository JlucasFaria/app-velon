import prismaClient from "../../db/client";
import type { PrismaClient, ClientType } from "../../../generated/prisma";
import {
  getPaginationParams,
  createPaginationMeta,
} from "../../utils/pagination";
import type { CreateClientInput, UpdateClientInput } from "./client-schema";

const CLIENT_SELECT = {
  id: true,
  name: true,
  document: true,
  phone: true,
  address: true,
  clientType: true,
  partnerName: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  description: true,
  value: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class ClientService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async create(data: CreateClientInput, companyId: number) {
    return await this.prisma.client.create({
      data: { ...data, companyId },
      select: CLIENT_SELECT,
    });
  }

  async getAll(
    companyId: number,
    page?: string | number,
    limit?: string | number,
    clientType?: ClientType,
    search?: string,
  ) {
    const params = getPaginationParams(page, limit);

    const where = {
      companyId,
      ...(clientType ? { clientType } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { document: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { id: "asc" },
        select: CLIENT_SELECT,
      }),
      this.prisma.client.count({ where }),
    ]);

    const pagination = createPaginationMeta(params.page, params.limit, total);

    return { clients, pagination };
  }

  async findById(id: number, companyId: number) {
    return await this.prisma.client.findFirst({
      where: { id, companyId },
      select: {
        ...CLIENT_SELECT,
        orders: {
          select: ORDER_SELECT,
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  // Returns null when the client does not exist or belongs to another company,
  // so the route can answer 404 without leaking cross-tenant existence.
  async update(id: number, companyId: number, data: UpdateClientInput) {
    const owned = await this.prisma.client.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!owned) return null;

    return await this.prisma.client.update({
      where: { id },
      data,
      select: CLIENT_SELECT,
    });
  }

  async delete(id: number, companyId: number) {
    const owned = await this.prisma.client.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!owned) return null;

    return await this.prisma.client.delete({
      where: { id },
    });
  }
}
