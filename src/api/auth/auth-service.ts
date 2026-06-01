import crypto from "crypto";
import prismaClient from "../../db/client";
import type { PrismaClient } from "../../../generated/prisma";
import { REFRESH_TOKEN_TTL_MS } from "../../config/constants";

export class AuthService {
  constructor(private prisma: PrismaClient = prismaClient) {}
  async generateRefreshToken(userId: number) {
    const token = crypto.randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: { token, userId, expiresAt },
    });

    return token;
  }

  async validateRefreshToken(token: string) {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!refreshToken) return null;

    if (refreshToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { token } });
      return null;
    }

    await this.prisma.refreshToken.update({
      where: { token },
      data: { lastUsedAt: new Date() },
    });

    return refreshToken;
  }

  async revokeRefreshToken(token: string) {
    await this.prisma.refreshToken.delete({ where: { token } });
  }

  // Atomically revokes oldToken and issues a new one in a single transaction.
  // Prevents the user from being left without a valid refresh token if the
  // create step fails after the delete step has already committed.
  async rotateRefreshToken(oldToken: string, userId: number): Promise<string> {
    return await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.delete({ where: { token: oldToken } });
      const token = crypto.randomBytes(40).toString("hex");
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
      await tx.refreshToken.create({ data: { token, userId, expiresAt } });
      return token;
    });
  }

  // Reserved for "logout all devices" flows (e.g. password change, account compromise)
  async revokeAllUserTokens(userId: number) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
