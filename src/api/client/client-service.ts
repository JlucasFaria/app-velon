import prismaClient from "../../db/client";
import type { PrismaClient, ClientType } from "../../../generated/prisma";
import {
  getPaginationParams,
  createPaginationMeta,
} from "../../utils/pagination";
import type { CreateClientInput, UpdateClientInput } from "./client-schema";

const CLIENT_SELECT = {
  id: true,
  registrationNumber: true,
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

  // Uses SQL MAX (which skips NULLs) rather than an ordered findFirst: Postgres
  // sorts NULLS FIRST on DESC, so a client with a null registrationNumber (e.g.
  // inserted out-of-band by a seed/import) would otherwise be read as the
  // "latest" and reset the sequence back to 1, colliding on the unique index.
  private async generateRegistrationNumber(companyId: number): Promise<number> {
    const result = await this.prisma.client.aggregate({
      where: { companyId },
      _max: { registrationNumber: true },
    });
    return (result._max.registrationNumber ?? 0) + 1;
  }

  async create(data: CreateClientInput, companyId: number) {
    const registrationNumber = await this.generateRegistrationNumber(companyId);
    return await this.prisma.client.create({
      data: { ...data, companyId, registrationNumber },
      select: CLIENT_SELECT,
    });
  }

  async getAll(
    companyId: number,
    page?: string | number,
    limit?: string | number,
    clientType?: ClientType,
    search?: string,
    partnerName?: string,
  ) {
    const params = getPaginationParams(page, limit);

    const where = {
      companyId,
      ...(clientType ? { clientType } : {}),
      ...(partnerName
        ? { partnerName: { contains: partnerName, mode: "insensitive" as const } }
        : {}),
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
      data: {
        ...data,
        // Changing to COUNTER must clear partnerName; Prisma ignores undefined.
        ...(data.clientType === "COUNTER" ? { partnerName: null } : {}),
      },
      select: CLIENT_SELECT,
    });
  }

  async search(companyId: number, q: string) {
    return await this.prisma.client.findMany({
      where: {
        companyId,
        name: { contains: q, mode: "insensitive" },
      },
      select: { id: true, name: true, document: true, clientType: true },
      take: 5,
      orderBy: { name: "asc" },
    });
  }

  async getPartnerNameSuggestions(companyId: number, q?: string) {
    const clients = await this.prisma.client.findMany({
      where: {
        companyId,
        clientType: "PARTNER",
        partnerName: q
          ? { contains: q, mode: "insensitive" }
          : { not: null },
      },
      select: { partnerName: true },
      distinct: ["partnerName"],
      orderBy: { partnerName: "asc" },
    });
    return clients.map((c) => c.partnerName as string);
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
