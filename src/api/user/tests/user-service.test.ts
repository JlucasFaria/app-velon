// Unit tests for UserService — runs directly against the database
import { describe, it, expect, beforeEach } from "bun:test";
import { UserService } from "../user-service";
import prisma from "../../../db/client";

const userService = new UserService();

describe("UserService", () => {
  beforeEach(async () => {
    // FK-safe order: receipts → orders (cascades StatusHistory) → users
    await prisma.receipt.deleteMany();
    await prisma.serviceOrder.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("create", () => {
    it("should create a user and return it without the password field", async () => {
      const user = await userService.create({
        email: "dev@test.com",
        name: "Dev Test",
        password: "secret1234",
      });

      expect(user).toHaveProperty("id");
      expect(user.email).toBe("dev@test.com");
      expect(user.name).toBe("Dev Test");
      expect(user).not.toHaveProperty("password");
    });
  });

  describe("getAll", () => {
    it("should return all users with correct count", async () => {
      await userService.create({
        email: "user1@test.com",
        password: "secret1234",
      });
      await userService.create({
        email: "user2@test.com",
        password: "secret1234",
      });

      const result = await userService.getAll();

      expect(result.users.length).toBe(2);
      expect(result.users[0]).not.toHaveProperty("password");
    });
    it("should return users ordered by id ascending", async () => {
      const first = await userService.create({
        email: "user1@test.com",
        password: "secret1234",
      });
      const second = await userService.create({
        email: "user2@test.com",
        password: "secret1234",
      });

      const result = await userService.getAll();

      expect(result.users[0]?.id).toBe(first.id);
      expect(result.users[1]?.id).toBe(second.id);
    });

    it("should return correct pagination metadata", async () => {
      await userService.create({
        email: "user1@test.com",
        password: "secret1234",
      });
      await userService.create({
        email: "user2@test.com",
        password: "secret1234",
      });

      const result = await userService.getAll("1", "1");

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });
  });

  describe("findByEmail", () => {
    it("should return the user when email exists", async () => {
      await userService.create({
        email: "dev@test.com",
        password: "secret1234",
      });

      const user = await userService.findByEmail("dev@test.com");

      expect(user).not.toBeNull();
      expect(user?.email).toBe("dev@test.com");
    });

    it("should return null when email does not exist", async () => {
      const user = await userService.findByEmail("notfound@test.com");

      expect(user).toBeNull();
    });
  });

  describe("verifyPassword", () => {
    it("should return true for the correct password", async () => {
      await userService.create({
        email: "dev@test.com",
        password: "secret1234",
      });
      const user = await userService.findByEmail("dev@test.com");

      const result = await userService.verifyPassword(
        user!.password,
        "secret1234",
      );

      expect(result).toBe(true);
    });

    it("should return false for a wrong password", async () => {
      await userService.create({
        email: "dev@test.com",
        password: "secret1234",
      });
      const user = await userService.findByEmail("dev@test.com");

      const result = await userService.verifyPassword(
        user!.password,
        "wrongpassword",
      );

      expect(result).toBe(false);
    });
  });
});
