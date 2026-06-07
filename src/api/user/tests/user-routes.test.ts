// Integration tests for User Routes — sends real HTTP requests to the Hono app
import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import { sign } from "hono/jwt";
import { env } from "../../../config/env";

describe("User Routes", () => {
  let token: string;

  // Generate JWT token once — we only need to do this once since
  // it doesn't depend on database state. The auth middleware validates
  // the signature, not whether the user exists in the DB.
  beforeAll(async () => {
    const payload = {
      id: 1,
      email: "test@example.com",
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    };
    token = await sign(payload, env.JWT_SECRET);
  });

  // Clean the database before each test to ensure test isolation.
  // This prevents one test's data from affecting another.
  beforeEach(async () => {
    await prisma.serviceOrder.deleteMany(); // cascades StatusHistory; clears changedById and assignedUserId FK refs
    await prisma.user.deleteMany();
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

    it("should return paginated user list with a valid auth token", async () => {
      const res = await app.request("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        data: { pagination: { page: number } };
      };
      expect(res.status).toBe(200);
      expect(body.data.pagination.page).toBe(1);
    });

    it("should use page 1 when page=-5 is provided", async () => {
      const res = await app.request("/api/users?page=-5", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        data: { pagination: { page: number } };
      };
      expect(res.status).toBe(200);
      expect(body.data.pagination.page).toBe(1);
    });

    it("should use limit 1 when limit=0 is provided", async () => {
      const res = await app.request("/api/users?limit=0", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        data: { pagination: { limit: number } };
      };
      expect(res.status).toBe(200);
      expect(body.data.pagination.limit).toBe(1);
    });

    it("should cap limit at 100 when limit=101 is provided", async () => {
      const res = await app.request("/api/users?limit=101", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        data: { pagination: { limit: number } };
      };
      expect(res.status).toBe(200);
      expect(body.data.pagination.limit).toBe(100);
    });

    it("should use page 1 when page=abc is provided", async () => {
      const res = await app.request("/api/users?page=abc", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        data: { pagination: { page: number } };
      };
      expect(res.status).toBe(200);
      expect(body.data.pagination.page).toBe(1);
    });

    it("should use default limit of 10 when limit is an empty string", async () => {
      const res = await app.request("/api/users?limit=", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        data: { pagination: { limit: number } };
      };
      expect(res.status).toBe(200);
      expect(body.data.pagination.limit).toBe(10);
    });

    it("should respect pagination params: return correct page and limit", async () => {
      // Create 3 users so we have data to paginate
      for (let i = 1; i <= 3; i++) {
        await app.request("/api/users", {
          method: "POST",
          body: JSON.stringify({
            email: `user${i}@example.com`,
            password: "Secret1234",
          }),
          headers: { "Content-Type": "application/json" },
        });
      }

      // Request page 1 with a limit of 2 — should return 2 users out of 3
      const res = await app.request("/api/users?page=1&limit=2", {
        headers: { Authorization: `Bearer ${token}` },
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
  // Using an unauthenticated GET so this block has no dependency on `token`.
  it("should include X-Content-Type-Options: nosniff", async () => {
    const res = await app.request("/api/users");

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("should include X-Frame-Options", async () => {
    const res = await app.request("/api/users");

    expect(res.headers.get("X-Frame-Options")).not.toBeNull();
  });
});
