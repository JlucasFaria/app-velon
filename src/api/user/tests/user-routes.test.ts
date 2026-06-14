// Integration tests for User Routes — sends real HTTP requests to the Hono app
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import {
  createTestAuthContext,
  signTestToken,
  type TestAuthContext,
} from "../../../test-utils/company";

describe("User Routes", () => {
  let ctx: TestAuthContext;

  // Re-create a fresh company + admin user before each test so every test
  // starts from a clean, consistent state.
  beforeEach(async () => {
    await prisma.receipt.deleteMany();
    await prisma.serviceOrder.deleteMany();
    await prisma.client.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.company.deleteMany();
    await prisma.user.deleteMany();
    ctx = await createTestAuthContext({ role: "ADMIN" });
  });

  // ─── POST /api/users ─────────────────────────────────────────

  describe("POST /api/users", () => {
    it("should create a new user and return 201", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          name: "Test User",
          password: "Secret1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const body = (await res.json()) as {
        success: true;
        data: { email: string; id: number; name: string | null };
      };

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe("test@example.com");
      // Password must never be returned in the API response
      expect(body.data).not.toHaveProperty("password");
    });

    it("should return 400 when password is missing", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          name: "Test User",
          // password field is intentionally omitted
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when password is shorter than 8 characters", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          name: "Test User",
          password: "short",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when password has no uppercase letter", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "secret1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when password has no lowercase letter", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "SECRET1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when password has no number", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "SecretPass",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when email is invalid", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "not-an-email",
          password: "Secret1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when name has less than 2 characters", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          name: "A",
          password: "Secret1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when body is empty", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when email field is missing", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({ password: "Secret1234" }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });

    it("should return 409 when email is already in use", async () => {
      // First registration — should succeed
      await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "duplicate@example.com",
          password: "Secret1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      // Second registration with the same email — should conflict
      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "duplicate@example.com",
          password: "Secret1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(409);
    });
  });

  // ─── GET /api/users ──────────────────────────────────────────

  describe("GET /api/users", () => {
    it("should return 401 when no auth token is provided", async () => {
      const res = await app.request("/api/users");

      expect(res.status).toBe(401);
    });

    it("should return 401 when an invalid auth token is provided", async () => {
      const res = await app.request("/api/users", {
        headers: { Authorization: "Bearer invalid.token.here" },
      });

      expect(res.status).toBe(401);
    });

    it("should return 403 when token has no company (pre-onboarding user)", async () => {
      // Token without companyId simulates a user who registered but hasn't
      // completed onboarding yet. The company-scoped listing must reject it.
      const noCompanyToken = await signTestToken(
        ctx.userId,
        ctx.email,
        null,
        null,
      );
      const res = await app.request("/api/users", {
        headers: { Authorization: `Bearer ${noCompanyToken}` },
      });

      expect(res.status).toBe(403);
    });

    it("should return only members of the caller's company", async () => {
      // Create a second company with its own user — should NOT appear in results
      await createTestAuthContext({
        email: "other-company@example.com",
        companyName: "Other Company",
      });

      const res = await app.request("/api/users", {
        headers: { Authorization: `Bearer ${ctx.token}` },
      });

      const body = (await res.json()) as {
        success: true;
        data: { users: Array<{ email: string }>; pagination: object };
      };

      expect(res.status).toBe(200);
      expect(
        body.data.users.every((u) => u.email !== "other-company@example.com"),
      ).toBe(true);
    });

    it("should return paginated member list with a valid auth token", async () => {
      const res = await app.request("/api/users", {
        headers: { Authorization: `Bearer ${ctx.token}` },
      });

      const body = (await res.json()) as {
        success: true;
        data: {
          users: Array<{ id: number; email: string; name?: string | null }>;
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.users)).toBe(true);
      expect(body.data.pagination).toBeDefined();
    });

    it("should use page 1 when page=0 is provided", async () => {
      const res = await app.request("/api/users?page=0", {
        headers: { Authorization: `Bearer ${ctx.token}` },
      });
      const body = (await res.json()) as {
        data: { pagination: { page: number } };
      };
      expect(res.status).toBe(200);
      expect(body.data.pagination.page).toBe(1);
    });

    it("should use page 1 when page=-5 is provided", async () => {
      const res = await app.request("/api/users?page=-5", {
        headers: { Authorization: `Bearer ${ctx.token}` },
      });
      const body = (await res.json()) as {
        data: { pagination: { page: number } };
      };
      expect(res.status).toBe(200);
      expect(body.data.pagination.page).toBe(1);
    });

    it("should use limit 1 when limit=0 is provided", async () => {
      const res = await app.request("/api/users?limit=0", {
        headers: { Authorization: `Bearer ${ctx.token}` },
      });
      const body = (await res.json()) as {
        data: { pagination: { limit: number } };
      };
      expect(res.status).toBe(200);
      expect(body.data.pagination.limit).toBe(1);
    });

    it("should cap limit at 100 when limit=101 is provided", async () => {
      const res = await app.request("/api/users?limit=101", {
        headers: { Authorization: `Bearer ${ctx.token}` },
      });
      const body = (await res.json()) as {
        data: { pagination: { limit: number } };
      };
      expect(res.status).toBe(200);
      expect(body.data.pagination.limit).toBe(100);
    });

    it("should use page 1 when page=abc is provided", async () => {
      const res = await app.request("/api/users?page=abc", {
        headers: { Authorization: `Bearer ${ctx.token}` },
      });
      const body = (await res.json()) as {
        data: { pagination: { page: number } };
      };
      expect(res.status).toBe(200);
      expect(body.data.pagination.page).toBe(1);
    });

    it("should use default limit of 10 when limit is an empty string", async () => {
      const res = await app.request("/api/users?limit=", {
        headers: { Authorization: `Bearer ${ctx.token}` },
      });
      const body = (await res.json()) as {
        data: { pagination: { limit: number } };
      };
      expect(res.status).toBe(200);
      expect(body.data.pagination.limit).toBe(10);
    });

    it("should respect pagination params: return correct page and limit", async () => {
      // Add 2 more members to ctx.companyId so we have 3 total (ctx user + 2)
      for (let i = 1; i <= 2; i++) {
        const user = await prisma.user.create({
          data: { email: `member${i}@example.com`, password: "hashed" },
        });
        await prisma.membership.create({
          data: {
            userId: user.id,
            companyId: ctx.companyId,
            role: "OPERATOR",
            status: "ACTIVE",
          },
        });
      }

      const res = await app.request("/api/users?page=1&limit=2", {
        headers: { Authorization: `Bearer ${ctx.token}` },
      });

      const body = (await res.json()) as {
        success: true;
        data: {
          users: Array<{ id: number; email: string }>;
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
      };

      expect(res.status).toBe(200);
      expect(body.data.users.length).toBe(2);
      expect(body.data.pagination.page).toBe(1);
      expect(body.data.pagination.limit).toBe(2);
      expect(body.data.pagination.total).toBe(3);
      expect(body.data.pagination.totalPages).toBe(2);
    });
  });
});

// ─── PATCH /api/users/me ─────────────────────────────────────────────────────

describe("PATCH /api/users/me", () => {
  const createdUserIds: number[] = [];

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  async function makeUser(password = "Secret1234") {
    const email = `me-${crypto.randomUUID()}@test.com`;
    const res = await app.request("/api/users", {
      method: "POST",
      body: JSON.stringify({ email, password, name: "Original Name" }),
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "127.0.0.40",
      },
    });
    const body = (await res.json()) as { data: { id: number } };
    createdUserIds.push(body.data.id);

    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "127.0.0.40",
      },
    });
    const loginBody = (await loginRes.json()) as { data: { token: string } };
    return { id: body.data.id, email, token: loginBody.data.token };
  }

  it("should return 401 when no token is provided", async () => {
    const res = await app.request("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "127.0.0.40",
      },
    });
    expect(res.status).toBe(401);
  });

  it("should update name without requiring current password", async () => {
    const { token } = await makeUser();

    const res = await app.request("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Name" }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Forwarded-For": "127.0.0.40",
      },
    });

    const body = (await res.json()) as { success: boolean; data: { name: string } };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("Updated Name");
    expect(body.data).not.toHaveProperty("password");
  });

  it("should update email when correct currentPassword is provided", async () => {
    const { token } = await makeUser("Secret1234");
    const newEmail = `new-${crypto.randomUUID()}@test.com`;

    const res = await app.request("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        email: newEmail,
        currentPassword: "Secret1234",
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Forwarded-For": "127.0.0.40",
      },
    });

    const body = (await res.json()) as { success: boolean; data: { email: string } };
    expect(res.status).toBe(200);
    expect(body.data.email).toBe(newEmail.toLowerCase());
  });

  it("should return 401 when wrong currentPassword is provided for email change", async () => {
    const { token } = await makeUser("Secret1234");

    const res = await app.request("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        email: `other-${crypto.randomUUID()}@test.com`,
        currentPassword: "WrongPass999",
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Forwarded-For": "127.0.0.40",
      },
    });

    expect(res.status).toBe(401);
  });

  it("should return 400 when email change is requested without currentPassword", async () => {
    const { token } = await makeUser();

    const res = await app.request("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({ email: `no-pass-${crypto.randomUUID()}@test.com` }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Forwarded-For": "127.0.0.40",
      },
    });

    expect(res.status).toBe(400);
  });

  it("should update password when correct currentPassword is provided", async () => {
    const { email, token } = await makeUser("Secret1234");

    const patchRes = await app.request("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "Secret1234",
        newPassword: "NewPass5678",
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Forwarded-For": "127.0.0.40",
      },
    });
    expect(patchRes.status).toBe(200);

    // Confirm new password works for login
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "NewPass5678" }),
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "127.0.0.40",
      },
    });
    expect(loginRes.status).toBe(200);
  });

  it("should return 401 when wrong currentPassword is provided for password change", async () => {
    const { token } = await makeUser("Secret1234");

    const res = await app.request("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "WrongOld999",
        newPassword: "NewPass5678",
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Forwarded-For": "127.0.0.40",
      },
    });

    expect(res.status).toBe(401);
  });

  it("should return 400 when newPassword change is requested without currentPassword", async () => {
    const { token } = await makeUser();

    const res = await app.request("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({ newPassword: "NewPass5678" }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Forwarded-For": "127.0.0.40",
      },
    });

    expect(res.status).toBe(400);
  });

  it("should return 409 when new email is already taken by another user", async () => {
    const userA = await makeUser();
    const userB = await makeUser();

    const res = await app.request("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        email: userA.email,
        currentPassword: "Secret1234",
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userB.token}`,
        "X-Forwarded-For": "127.0.0.40",
      },
    });

    expect(res.status).toBe(409);
  });
});

// ─── Body limit ──────────────────────────────────────────────────────────────

describe("User Routes — body limit", () => {
  it("should return 413 when request body exceeds 1 MB", async () => {
    // Build a payload that exceeds the 1 MB body limit
    const body = JSON.stringify({
      email: "limit@example.com",
      password: "Secret1234",
      name: "A".repeat(1024 * 1024 + 1),
    });

    const res = await app.request("/api/users", {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        // Provide Content-Length so the bodyLimit middleware can check it
        // without having to fully buffer the stream first
        "Content-Length": String(new TextEncoder().encode(body).length),
      },
    });

    expect(res.status).toBe(413);
  });
});

// ─── CORS headers ────────────────────────────────────────────────────────────

describe("User Routes — CORS headers", () => {
  it("should include Access-Control-Allow-Origin when Origin header is sent", async () => {
    const res = await app.request("/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: "cors@example.com",
        password: "Secret1234",
      }),
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).not.toBeNull();
  });
});

// ─── Security headers ─────────────────────────────────────────────────────────

describe("User Routes — security headers", () => {
  // Security headers are applied globally, regardless of auth status.
  // Using an unauthenticated GET so this block has no dependency on a token.
  it("should include X-Content-Type-Options: nosniff", async () => {
    const res = await app.request("/api/users");

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("should include X-Frame-Options", async () => {
    const res = await app.request("/api/users");

    expect(res.headers.get("X-Frame-Options")).not.toBeNull();
  });
});
