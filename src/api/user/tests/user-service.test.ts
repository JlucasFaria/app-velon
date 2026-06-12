// Unit tests for UserService — runs directly against the database.
//
// Each test creates its own UUID-email users (and, where needed, an isolated
// company) and cleans up only those rows in afterEach — no global deleteMany,
// so it can't race with rows created by parallel test files.
import { describe, it, expect, afterEach } from "bun:test";
import { UserService } from "../user-service";
import prisma from "../../../db/client";

const userService = new UserService();

describe("UserService", () => {
  const createdUserIds: number[] = [];
  const createdCompanyIds: number[] = [];

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      // Deleting a user cascades its memberships and refresh tokens.
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    if (createdCompanyIds.length > 0) {
      await prisma.company.deleteMany({
        where: { id: { in: createdCompanyIds } },
      });
      createdCompanyIds.length = 0;
    }
  });

  // Creates a user via the service and tracks it for cleanup.
  async function makeUser(overrides?: {
    email?: string;
    name?: string | null;
    password?: string;
  }) {
    const user = await userService.create({
      email: overrides?.email ?? `us-${crypto.randomUUID()}@test.com`,
      name: overrides?.name,
      password: overrides?.password ?? "secret1234",
    });
    createdUserIds.push(user.id);
    return user;
  }

  // Creates an isolated company and tracks it for cleanup.
  async function makeCompany() {
    const company = await prisma.company.create({
      data: { name: `Co ${crypto.randomUUID()}` },
    });
    createdCompanyIds.push(company.id);
    return company;
  }

  async function addMember(companyId: number, userId: number) {
    await prisma.membership.create({
      data: { companyId, userId, role: "OPERATOR", status: "ACTIVE" },
    });
  }

  describe("create", () => {
    it("should create a user and return it without the password field", async () => {
      const email = `us-${crypto.randomUUID()}@test.com`;
      const user = await makeUser({ email, name: "Dev Test" });

      expect(user).toHaveProperty("id");
      expect(user.email).toBe(email);
      expect(user.name).toBe("Dev Test");
      expect(user).not.toHaveProperty("password");
    });
  });

  // getAllByCompany is the company-scoped listing the API actually uses; its
  // counts are scoped to a single company, so the tests stay isolated.
  describe("getAllByCompany", () => {
    it("should return the company's active members with correct count", async () => {
      const company = await makeCompany();
      const u1 = await makeUser();
      const u2 = await makeUser();
      await addMember(company.id, u1.id);
      await addMember(company.id, u2.id);

      const result = await userService.getAllByCompany(company.id);

      expect(result.users.length).toBe(2);
      expect(result.users[0]).not.toHaveProperty("password");
    });

    it("should return users ordered by id ascending", async () => {
      const company = await makeCompany();
      const first = await makeUser();
      const second = await makeUser();
      await addMember(company.id, first.id);
      await addMember(company.id, second.id);

      const result = await userService.getAllByCompany(company.id);

      expect(result.users[0]?.id).toBe(first.id);
      expect(result.users[1]?.id).toBe(second.id);
    });

    it("should return correct pagination metadata", async () => {
      const company = await makeCompany();
      const u1 = await makeUser();
      const u2 = await makeUser();
      await addMember(company.id, u1.id);
      await addMember(company.id, u2.id);

      const result = await userService.getAllByCompany(company.id, "1", "1");

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it("should not include members from other companies", async () => {
      const company = await makeCompany();
      const other = await makeCompany();
      const mine = await makeUser();
      const theirs = await makeUser();
      await addMember(company.id, mine.id);
      await addMember(other.id, theirs.id);

      const result = await userService.getAllByCompany(company.id);

      expect(result.users.length).toBe(1);
      expect(result.users[0]?.id).toBe(mine.id);
    });
  });

  describe("findByEmail", () => {
    it("should return the user when email exists", async () => {
      const email = `us-${crypto.randomUUID()}@test.com`;
      await makeUser({ email });

      const user = await userService.findByEmail(email);

      expect(user).not.toBeNull();
      expect(user?.email).toBe(email);
    });

    it("should return null when email does not exist", async () => {
      const user = await userService.findByEmail(
        `missing-${crypto.randomUUID()}@test.com`,
      );

      expect(user).toBeNull();
    });
  });

  describe("verifyPassword", () => {
    it("should return true for the correct password", async () => {
      const email = `us-${crypto.randomUUID()}@test.com`;
      await makeUser({ email, password: "secret1234" });
      const user = await userService.findByEmail(email);

      const result = await userService.verifyPassword(
        user!.password,
        "secret1234",
      );

      expect(result).toBe(true);
    });

    it("should return false for a wrong password", async () => {
      const email = `us-${crypto.randomUUID()}@test.com`;
      await makeUser({ email, password: "secret1234" });
      const user = await userService.findByEmail(email);

      const result = await userService.verifyPassword(
        user!.password,
        "wrongpassword",
      );

      expect(result).toBe(false);
    });
  });
});
