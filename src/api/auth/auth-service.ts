import crypto from "crypto";
import prismaClient from "../../db/client";
import type { PrismaClient } from "../../../generated/prisma";
import {
  PASSWORD_RESET_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from "../../config/constants";

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

  // Issues a single-use password reset token for the user. Any prior unused
  // tokens are dropped first (single active token per request), so an older
  // link can't still be valid once a fresh one is requested.
  async createPasswordResetToken(userId: number): Promise<string> {
    const token = crypto.randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    return await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: { userId, usedAt: null },
      });
      await tx.passwordResetToken.create({
        data: { token, userId, expiresAt },
      });
      return token;
    });
  }

  // Validates a reset token (exists, not expired, not already used) and marks it
  // used, so it can never be redeemed twice. The conditional UPDATE is an atomic
  // compare-and-swap: a concurrent second call matches 0 rows, closing the
  // double-use race. Returns the owning userId on success, or null if invalid.
  async consumePasswordResetToken(
    token: string,
  ): Promise<{ userId: number } | null> {
    const claimed = await this.prisma.passwordResetToken.updateMany({
      where: { token, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    if (claimed.count === 0) return null;

    return await this.prisma.passwordResetToken.findUnique({
      where: { token },
      select: { userId: true },
    });
  }
}
