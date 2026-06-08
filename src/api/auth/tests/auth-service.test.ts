// Unit tests for AuthService — runs directly against the database
import { describe, it, expect, beforeEach } from "bun:test";
import { AuthService } from "../auth-service";
import { UserService } from "../../user/user-service";
import prisma from "../../../db/client";
import crypto from "crypto";

const authService = new AuthService();
const userService = new UserService();

describe("AuthService", () => {
  let userId: number;

  beforeEach(async () => {
    // FK-safe order: receipts → orders (cascades StatusHistory) → users
    await prisma.receipt.deleteMany();
    await prisma.serviceOrder.deleteMany();
    await prisma.user.deleteMany();
    const user = await userService.create({
      email: "auth@test.com",
      password: "secret1234",
    });
    userId = user.id;
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
});
