// Business service for user operations
import prismaClient from "../../db/client";
import type { PrismaClient } from "../../../generated/prisma";
import {
  getPaginationParams,
  createPaginationMeta,
} from "../../utils/pagination";

export class UserService {
  constructor(private prisma: PrismaClient = prismaClient) {}
  async create(data: {
    email: string;
    name?: string | null;
    password: string;
  }) {
    const { password, ...rest } = data;
    const hashedPassword = await Bun.password.hash(password);

    return await this.prisma.user.create({
      data: {
        ...rest,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async registerUser(data: { email: string; name: string; password: string }) {
    const hashedPassword = await Bun.password.hash(data.password);
    return await this.prisma.user.create({
      data: { email: data.email, name: data.name, password: hashedPassword },
      select: { id: true, email: true },
    });
  }

  async getAll(page?: string | number, limit?: string | number) {
    const params = getPaginationParams(page, limit);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: params.skip,
        take: params.limit,
        orderBy: { id: "asc" },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    const pagination = createPaginationMeta(params.page, params.limit, total);

    return { users, pagination };
  }

  // Returns only users who have an active membership in the given company.
  // Replaces getAll() for the GET /api/users endpoint to prevent cross-tenant data exposure.
  async getAllByCompany(
    companyId: number,
    page?: string | number,
    limit?: string | number,
  ) {
    const params = getPaginationParams(page, limit);
    const companyFilter = {
      memberships: { some: { companyId, status: "ACTIVE" as const } },
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: companyFilter,
        skip: params.skip,
        take: params.limit,
        orderBy: { id: "asc" },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where: companyFilter }),
    ]);

    return {
      users,
      pagination: createPaginationMeta(params.page, params.limit, total),
    };
  }

  async verifyPassword(hash: string, password: string) {
    return await Bun.password.verify(password, hash);
  }

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: number) {
    return await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });
  }

  // Active company membership used by auth to scope the access token.
  // Returns the first active membership (single-company per user for now).
  async getActiveMembership(userId: number) {
    return await this.prisma.membership.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { id: "asc" },
      select: { companyId: true, role: true },
    });
  }
}
