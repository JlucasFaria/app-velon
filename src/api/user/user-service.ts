// Business service for user operations
import prismaClient from "../../db/client";
import type { PrismaClient } from "../../../generated/prisma";
import { HTTPException } from "hono/http-exception";
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
    const { password, email, ...rest } = data;
    const hashedPassword = await Bun.password.hash(password);

    return await this.prisma.user.create({
      data: {
        ...rest,
        // Normalize to lower-case so lookups (login, invite checks) are
        // case-insensitive and a single email can't yield duplicate accounts.
        email: email.trim().toLowerCase(),
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
      data: {
        email: data.email.trim().toLowerCase(),
        name: data.name,
        password: hashedPassword,
      },
      select: { id: true, email: true },
    });
  }

  // Returns only users who have an active membership in the given company —
  // the GET /api/users listing is company-scoped to prevent cross-tenant
  // data exposure.
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
      where: { email: email.trim().toLowerCase() },
    });
  }

  async findById(id: number) {
    return await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });
  }

  async updateMe(
    userId: number,
    data: {
      name?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    },
  ) {
    const updateData: {
      name?: string;
      email?: string;
      password?: string;
    } = {};

    if (data.email !== undefined || data.newPassword !== undefined) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });
      if (!user) throw new HTTPException(404, { message: "User not found" });
      const valid = await Bun.password.verify(
        data.currentPassword!,
        user.password,
      );
      if (!valid)
        throw new HTTPException(401, { message: "Invalid current password" });
    }

    if (data.name !== undefined) updateData.name = data.name;

    if (data.email !== undefined) {
      const normalized = data.email.trim().toLowerCase();
      const existing = await this.prisma.user.findUnique({
        where: { email: normalized },
      });
      if (existing && existing.id !== userId)
        throw new HTTPException(409, { message: "Email already in use" });
      updateData.email = normalized;
    }

    if (data.newPassword !== undefined) {
      updateData.password = await Bun.password.hash(data.newPassword);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Sets a new password directly, bypassing current-password verification —
  // used by the password reset flow, where the single-use reset token (not the
  // old password) authorizes the change.
  async updatePassword(userId: number, newPassword: string) {
    const hashedPassword = await Bun.password.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
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
