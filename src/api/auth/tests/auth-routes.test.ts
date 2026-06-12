// Integration tests for Auth Routes — tests login, refresh, and logout flows
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import app from "../../../../src/index";
import prisma from "../../../db/client";

// Helper: creates a user via POST /api/users and logs them in,
// returning the token pair. Avoids repeating this setup in every test.
async function createAndLogin(
  email = "auth@example.com",
  password = "Secret1234",
): Promise<{ token: string; refreshToken: string }> {
  await app.request("/api/users", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
  });

  const res = await app.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
  });

  const body = (await res.json()) as {
    data: { token: string; refreshToken: string };
  };
  return body.data;
}

describe("Auth Routes", () => {
  // Delete in FK-safe order: receipts → orders (cascades StatusHistory,
  // clearing changedById/assignedUserId refs) → users (cascades their
  // refresh tokens). Required because other test files create orders/receipts.
  beforeEach(async () => {
    await prisma.receipt.deleteMany();
    await prisma.serviceOrder.deleteMany();
    await prisma.user.deleteMany();
  });

  // ─── POST /api/auth/login ────────────────────────────────────────

  describe("POST /api/auth/login", () => {
    it("should return 200 with access token and refresh token on valid credentials", async () => {
      const { token, refreshToken } = await createAndLogin();

      expect(typeof token).toBe("string");
      expect(typeof refreshToken).toBe("string");
      expect(token.length).toBeGreaterThan(0);
      expect(refreshToken.length).toBeGreaterThan(0);
    });

    it("should log in with a different email casing than registration (emails normalized to lowercase)", async () => {
      // Register with a mixed-case email — stored lowercase by the service.
      await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "MixedCase@Example.com",
          password: "Secret1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      // Log in using a different casing; findByEmail normalizes the lookup.
      const res = await app.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "mixedcase@EXAMPLE.COM",
          password: "Secret1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const body = (await res.json()) as { data: { token: string } };
      expect(res.status).toBe(200);
      expect(typeof body.data.token).toBe("string");
    });

    it("should return 401 when password is wrong", async () => {
      await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "auth@example.com",
          password: "Secret1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await app.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "auth@example.com",
          password: "wrongpassword",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(401);
    });

    it("should return 401 when email does not exist", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "Secret1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(401);
    });

    it("should return the same error message for wrong password and nonexistent email", async () => {
      // Security: prevents email enumeration — the client cannot tell whether
      // the email exists or the password is wrong. Both return "Invalid credentials".
      await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: "auth@example.com",
          password: "Secret1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const wrongPasswordRes = await app.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "auth@example.com",
          password: "wrongpassword",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const noEmailRes = await app.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "Secret1234",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const body1 = (await wrongPasswordRes.json()) as { error: string };
      const body2 = (await noEmailRes.json()) as { error: string };

      expect(body1.error).toBe(body2.error);
    });

    it("should return 400 when email field is missing", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password: "Secret1234" }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when email format is invalid", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "not-an-email", password: "Secret1234" }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/auth/refresh ──────────────────────────────────────

  describe("POST /api/auth/refresh", () => {
    it("should return a new token pair when refresh token is valid", async () => {
      const { refreshToken: originalToken } = await createAndLogin();

      const res = await app.request("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: originalToken }),
        headers: { "Content-Type": "application/json" },
      });

      const body = (await res.json()) as {
        success: true;
        data: { token: string; refreshToken: string };
      };

      expect(res.status).toBe(200);
      expect(body.data.token).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      // Token rotation: the new refresh token must differ from the original
      expect(body.data.refreshToken).not.toBe(originalToken);
    });

    it("should return 401 when refresh token is invalid", async () => {
      const res = await app.request("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({
          refreshToken: "invalid-token-that-does-not-exist",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(401);
    });

    it("should return 401 when the same refresh token is used twice (token rotation)", async () => {
      const { refreshToken } = await createAndLogin();

      // First use — consumes the token and issues a new one
      await app.request("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        headers: { "Content-Type": "application/json" },
      });

      // Second use — old token was revoked during the first refresh
      const res = await app.request("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/auth/logout ───────────────────────────────────────

  describe("POST /api/auth/logout", () => {
    it("should return 200 and a success message on logout", async () => {
      const { refreshToken } = await createAndLogin();

      const res = await app.request("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        headers: { "Content-Type": "application/json" },
      });

      const body = (await res.json()) as {
        success: true;
        data: { message: string };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe("Logged out successfully");
    });

    it("should return 200 even when token does not exist (idempotent logout)", async () => {
      // Logout must be idempotent — calling it with an already-revoked or
      // nonexistent token should not throw an error.
      const res = await app.request("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "nonexistent-token" }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(200);
    });

    it("should blacklist the access token so protected routes return 401 after logout", async () => {
      const { token, refreshToken } = await createAndLogin();

      // Logout sending the access token in the Authorization header
      await app.request("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // The blacklisted access token must no longer grant access
      const res = await app.request("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(401);
    });

    it("should invalidate the refresh token so it cannot be used after logout", async () => {
      const { refreshToken } = await createAndLogin();

      // Revoke the token via logout
      await app.request("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        headers: { "Content-Type": "application/json" },
      });

      // Attempt to use the revoked token — must fail
      const res = await app.request("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(401);
    });
  });
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
// These tests live outside the main "Auth Routes" describe so they do NOT
// trigger the global deleteMany beforeEach — they create users with UUID emails
// and clean up only those specific rows after each test.
//
// A dedicated X-Forwarded-For IP isolates these requests into their own
// rate-limit bucket, so they don't push the shared "unknown" bucket past the
// 100 req/window cap and trip 429s in other test files.

const REGISTER_IP = "127.0.0.30";
const ME_IP = "127.0.0.31";

const jsonHeaders = (ip: string, extra?: Record<string, string>) => ({
  "Content-Type": "application/json",
  "X-Forwarded-For": ip,
  ...extra,
});

describe("Register Route", () => {
  const createdEmails: string[] = [];

  afterEach(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
      createdEmails.length = 0;
    }
  });

  it("should return 201 with token pair on valid registration", async () => {
    const email = `reg-${crypto.randomUUID()}@test.com`;
    createdEmails.push(email);

    const res = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "João Silva",
        email,
        password: "senha123",
        passwordConfirmation: "senha123",
      }),
      headers: jsonHeaders(REGISTER_IP),
    });
    const body = (await res.json()) as {
      data: { token: string; refreshToken: string };
    };

    expect(res.status).toBe(201);
    expect(typeof body.data.token).toBe("string");
    expect(typeof body.data.refreshToken).toBe("string");
    expect(body.data.token.length).toBeGreaterThan(0);
  });

  it("should return 400 when name is missing", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: `reg-${crypto.randomUUID()}@test.com`,
        password: "senha123",
        passwordConfirmation: "senha123",
      }),
      headers: jsonHeaders(REGISTER_IP),
    });

    expect(res.status).toBe(400);
  });

  it("should return 400 when email is invalid", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "João",
        email: "not-an-email",
        password: "senha123",
        passwordConfirmation: "senha123",
      }),
      headers: jsonHeaders(REGISTER_IP),
    });

    expect(res.status).toBe(400);
  });

  it("should return 400 with pt-BR message when password is shorter than 8 chars", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "João",
        email: `reg-${crypto.randomUUID()}@test.com`,
        password: "abc1",
        passwordConfirmation: "abc1",
      }),
      headers: jsonHeaders(REGISTER_IP),
    });
    const text = await res.text();

    expect(res.status).toBe(400);
    expect(text).toContain("8 caracteres");
  });

  it("should return 400 when password has no letters", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "João",
        email: `reg-${crypto.randomUUID()}@test.com`,
        password: "12345678",
        passwordConfirmation: "12345678",
      }),
      headers: jsonHeaders(REGISTER_IP),
    });

    expect(res.status).toBe(400);
  });

  it("should return 400 when password has no numbers", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "João",
        email: `reg-${crypto.randomUUID()}@test.com`,
        password: "senhasemnum",
        passwordConfirmation: "senhasemnum",
      }),
      headers: jsonHeaders(REGISTER_IP),
    });

    expect(res.status).toBe(400);
  });

  it("should return 400 with pt-BR message when passwords do not match", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "João",
        email: `reg-${crypto.randomUUID()}@test.com`,
        password: "senha123",
        passwordConfirmation: "senha456",
      }),
      headers: jsonHeaders(REGISTER_IP),
    });
    const text = await res.text();

    expect(res.status).toBe(400);
    expect(text).toContain("As senhas não coincidem");
  });

  it("should return 409 with pt-BR message when email is already registered", async () => {
    const email = `reg-dup-${crypto.randomUUID()}@test.com`;
    createdEmails.push(email);

    await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "User",
        email,
        password: "senha123",
        passwordConfirmation: "senha123",
      }),
      headers: jsonHeaders(REGISTER_IP),
    });

    const res = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "User",
        email,
        password: "senha123",
        passwordConfirmation: "senha123",
      }),
      headers: jsonHeaders(REGISTER_IP),
    });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(409);
    expect(body.error).toBe("Este e-mail já está cadastrado");
  });

  it("should allow logging in with credentials after registration", async () => {
    const email = `reg-login-${crypto.randomUUID()}@test.com`;
    createdEmails.push(email);

    await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "João",
        email,
        password: "senha123",
        passwordConfirmation: "senha123",
      }),
      headers: jsonHeaders(REGISTER_IP),
    });

    const res = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "senha123" }),
      headers: jsonHeaders(REGISTER_IP),
    });

    expect(res.status).toBe(200);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe("Me Route", () => {
  const createdEmails: string[] = [];

  afterEach(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
      createdEmails.length = 0;
    }
  });

  it("should return 401 without a token", async () => {
    const res = await app.request("/api/auth/me", {
      headers: { "X-Forwarded-For": ME_IP },
    });
    expect(res.status).toBe(401);
  });

  it("should return hasCompany: false for a freshly registered user", async () => {
    const email = `me-${crypto.randomUUID()}@test.com`;
    createdEmails.push(email);

    const registerRes = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Novo",
        email,
        password: "senha123",
        passwordConfirmation: "senha123",
      }),
      headers: jsonHeaders(ME_IP),
    });
    const { data } = (await registerRes.json()) as { data: { token: string } };

    const res = await app.request("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${data.token}`,
        "X-Forwarded-For": ME_IP,
      },
    });
    const body = (await res.json()) as {
      data: { hasCompany: boolean; email: string; name: string };
    };

    expect(res.status).toBe(200);
    expect(body.data.hasCompany).toBe(false);
    expect(body.data.email).toBe(email);
    expect(body.data.name).toBe("Novo");
  });

  it("should return hasCompany: true after completing company setup", async () => {
    const email = `me-owner-${crypto.randomUUID()}@test.com`;
    createdEmails.push(email);

    const registerRes = await app.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Owner",
        email,
        password: "senha123",
        passwordConfirmation: "senha123",
      }),
      headers: jsonHeaders(ME_IP),
    });
    const { data: reg } = (await registerRes.json()) as {
      data: { token: string; refreshToken: string };
    };

    await app.request("/api/company/setup", {
      method: "POST",
      body: JSON.stringify({ name: "Empresa Teste" }),
      headers: jsonHeaders(ME_IP, { Authorization: `Bearer ${reg.token}` }),
    });

    // Refresh to get a token with companyId populated
    const refreshRes = await app.request("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: reg.refreshToken }),
      headers: jsonHeaders(ME_IP),
    });
    const { data: refreshed } = (await refreshRes.json()) as {
      data: { token: string };
    };

    const res = await app.request("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${refreshed.token}`,
        "X-Forwarded-For": ME_IP,
      },
    });
    const body = (await res.json()) as { data: { hasCompany: boolean } };

    expect(res.status).toBe(200);
    expect(body.data.hasCompany).toBe(true);
  });
});

// ─── CORS headers ────────────────────────────────────────────────────────────

describe("Auth Routes — CORS headers", () => {
  it("should include Access-Control-Allow-Origin when Origin header is sent", async () => {
    const res = await app.request("/api/auth/login", {
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

describe("Auth Routes — security headers", () => {
  it("should include X-Content-Type-Options: nosniff", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "sec@example.com",
        password: "Secret1234",
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("should include X-Frame-Options", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "sec@example.com",
        password: "Secret1234",
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.headers.get("X-Frame-Options")).not.toBeNull();
  });
});
