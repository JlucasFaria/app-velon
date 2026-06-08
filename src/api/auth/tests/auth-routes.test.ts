// Integration tests for Auth Routes — tests login, refresh, and logout flows
import { describe, it, expect, beforeEach } from "bun:test";
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
