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

  async create(data: CreateClientInput) {
    return await this.prisma.client.create({
      data,
      select: CLIENT_SELECT,
    });
  }

  async getAll(
    page?: string | number,
    limit?: string | number,
    clientType?: string,
    search?: string,
  ) {
    const params = getPaginationParams(page, limit);

    const where = {
      ...(clientType ? { clientType: clientType as ClientType } : {}),
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

  async findById(id: number) {
    return await this.prisma.client.findUnique({
      where: { id },
      select: {
        ...CLIENT_SELECT,
        orders: {
          select: ORDER_SELECT,
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async update(id: number, data: UpdateClientInput) {
    return await this.prisma.client.update({
      where: { id },
      data,
      select: CLIENT_SELECT,
    });
  }

  async delete(id: number) {
    return await this.prisma.client.delete({
      where: { id },
    });
  }
}
