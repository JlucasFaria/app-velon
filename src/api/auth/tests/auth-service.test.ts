// Unit tests for AuthService — runs directly against the database
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { AuthService } from "../auth-service";
import { UserService } from "../../user/user-service";
import prisma from "../../../db/client";
import crypto from "crypto";

const authService = new AuthService();
const userService = new UserService();

describe("AuthService", () => {
  let userId: number;

  // Each test owns a unique user (UUID email) and cleans up only its own row,
  // so this file never wipes data created by parallel test files. Deleting the
  // user cascades its refresh and password-reset tokens.
  beforeEach(async () => {
    const user = await userService.create({
      email: `auth-svc-${crypto.randomUUID()}@test.com`,
      password: "secret1234",
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  describe("generateRefreshToken", () => {
    it("should create a token in the database", async () => {
      const token = await authService.generateRefreshToken(userId);

      const stored = await prisma.refreshToken.findUnique({
        where: { token },
      });

      expect(stored).not.toBeNull();
      expect(stored?.userId).toBe(userId);
    });

    it("should set expiresAt to approximately 7 days from now", async () => {
      const before = Date.now();
      const token = await authService.generateRefreshToken(userId);

      const stored = await prisma.refreshToken.findUnique({
        where: { token },
      });

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(stored!.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + sevenDaysMs - 1000,
      );
      expect(stored!.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + sevenDaysMs + 1000,
      );
    });
  });

  describe("validateRefreshToken", () => {
    it("should return the token with user when token is valid", async () => {
      const token = await authService.generateRefreshToken(userId);

      const result = await authService.validateRefreshToken(token);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(userId);
      expect(result?.user.id).toBe(userId);
    });

    it("should return null for a nonexistent token", async () => {
      const result =
        await authService.validateRefreshToken("nonexistent-token");

      expect(result).toBeNull();
    });

    it("should delete the token and return null when it is expired", async () => {
      const token = crypto.randomBytes(40).toString("hex");
      await prisma.refreshToken.create({
        data: {
          token,
          userId,
          expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
        },
      });

      const result = await authService.validateRefreshToken(token);

      expect(result).toBeNull();
      const stored = await prisma.refreshToken.findUnique({ where: { token } });
      expect(stored).toBeNull();
    });
  });

  describe("revokeRefreshToken", () => {
    it("should remove the token from the database", async () => {
      const token = await authService.generateRefreshToken(userId);

      await authService.revokeRefreshToken(token);

      const stored = await prisma.refreshToken.findUnique({ where: { token } });
      expect(stored).toBeNull();
    });
  });

  describe("rotateRefreshToken", () => {
    it("should delete the old token and return a new one", async () => {
      const oldToken = await authService.generateRefreshToken(userId);

      const newToken = await authService.rotateRefreshToken(oldToken, userId);

      expect(newToken).not.toBe(oldToken);
      const oldStored = await prisma.refreshToken.findUnique({
        where: { token: oldToken },
      });
      expect(oldStored).toBeNull();
    });

    it("should persist the new token in the database linked to the user", async () => {
      const oldToken = await authService.generateRefreshToken(userId);

      const newToken = await authService.rotateRefreshToken(oldToken, userId);

      const newStored = await prisma.refreshToken.findUnique({
        where: { token: newToken },
      });
      expect(newStored).not.toBeNull();
      expect(newStored?.userId).toBe(userId);
    });

    it("should set expiresAt on the new token to approximately 7 days from now", async () => {
      const oldToken = await authService.generateRefreshToken(userId);

      const before = Date.now();
      const newToken = await authService.rotateRefreshToken(oldToken, userId);

      const newStored = await prisma.refreshToken.findUnique({
        where: { token: newToken },
      });
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(newStored!.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + sevenDaysMs - 1000,
      );
      expect(newStored!.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + sevenDaysMs + 1000,
      );
    });
  });

  describe("revokeAllUserTokens", () => {
    it("should remove all tokens for the given user", async () => {
      await authService.generateRefreshToken(userId);
      await authService.generateRefreshToken(userId);

      await authService.revokeAllUserTokens(userId);

      const tokens = await prisma.refreshToken.findMany({
        where: { userId },
      });
      expect(tokens.length).toBe(0);
    });
  });

  describe("createPasswordResetToken", () => {
    it("should create an unused reset token linked to the user", async () => {
      const token = await authService.createPasswordResetToken(userId);

      const stored = await prisma.passwordResetToken.findUnique({
        where: { token },
      });

      expect(stored).not.toBeNull();
      expect(stored?.userId).toBe(userId);
      expect(stored?.usedAt).toBeNull();
    });

    it("should set expiresAt to approximately 1 hour from now", async () => {
      const before = Date.now();
      const token = await authService.createPasswordResetToken(userId);

      const stored = await prisma.passwordResetToken.findUnique({
        where: { token },
      });

      const oneHourMs = 60 * 60 * 1000;
      expect(stored!.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + oneHourMs - 1000,
      );
      expect(stored!.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + oneHourMs + 1000,
      );
    });

    it("should drop prior unused tokens so only one stays active per request", async () => {
      const first = await authService.createPasswordResetToken(userId);
      const second = await authService.createPasswordResetToken(userId);

      expect(second).not.toBe(first);
      const firstStored = await prisma.passwordResetToken.findUnique({
        where: { token: first },
      });
      expect(firstStored).toBeNull();

      const active = await prisma.passwordResetToken.findMany({
        where: { userId, usedAt: null },
      });
      expect(active.length).toBe(1);
      expect(active[0]?.token).toBe(second);
    });

    it("should preserve already-used tokens when issuing a new one", async () => {
      const used = await authService.createPasswordResetToken(userId);
      await authService.consumePasswordResetToken(used);

      await authService.createPasswordResetToken(userId);

      const usedStored = await prisma.passwordResetToken.findUnique({
        where: { token: used },
      });
      expect(usedStored).not.toBeNull();
      expect(usedStored?.usedAt).not.toBeNull();
    });
  });

  describe("consumePasswordResetToken", () => {
    it("should return the userId and mark a valid token used", async () => {
      const token = await authService.createPasswordResetToken(userId);

      const result = await authService.consumePasswordResetToken(token);

      expect(result).toEqual({ userId });
      const stored = await prisma.passwordResetToken.findUnique({
        where: { token },
      });
      expect(stored?.usedAt).not.toBeNull();
    });

    it("should return null for a nonexistent token", async () => {
      const result =
        await authService.consumePasswordResetToken("nonexistent-token");

      expect(result).toBeNull();
    });

    it("should return null and not consume an already-used token twice", async () => {
      const token = await authService.createPasswordResetToken(userId);
      await authService.consumePasswordResetToken(token);

      const second = await authService.consumePasswordResetToken(token);

      expect(second).toBeNull();
    });

    it("should return null for an expired token and leave it unused", async () => {
      const token = crypto.randomBytes(40).toString("hex");
      await prisma.passwordResetToken.create({
        data: { token, userId, expiresAt: new Date(Date.now() - 1000) },
      });

      const result = await authService.consumePasswordResetToken(token);

      expect(result).toBeNull();
      const stored = await prisma.passwordResetToken.findUnique({
        where: { token },
      });
      expect(stored?.usedAt).toBeNull();
    });
  });
});
