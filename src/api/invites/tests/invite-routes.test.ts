// Integration tests for the invite accept flow
import { describe, it, expect } from "bun:test";
import crypto from "crypto";
import { verify } from "hono/jwt";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import { env } from "../../../config/env";
import { INVITE_TOKEN_TTL_MS } from "../../../config/constants";
import { createTestAuthContext } from "../../../test-utils/company";

// Unique IP per file to avoid rate-limit bucket collisions across test files.
const IP = "127.0.0.30";
const h = (extra?: Record<string, string>) => ({
  "X-Forwarded-For": IP,
  ...extra,
});
const json = (extra?: Record<string, string>) =>
  h({ "Content-Type": "application/json", ...extra });

// Creates a PENDING membership row directly in the DB and returns both the
// row and the raw token string (needed to build the accept URL).
async function createPendingInvite(
  companyId: number,
  opts?: {
    invitedEmail?: string;
    role?: "ADMIN" | "OPERATOR" | "VIEWER";
    expired?: boolean;
  },
) {
  const token = crypto.randomBytes(32).toString("hex");
  const inviteExpiresAt = opts?.expired
    ? new Date(Date.now() - 1_000)
    : new Date(Date.now() + INVITE_TOKEN_TTL_MS);

  const row = await prisma.membership.create({
    data: {
      companyId,
      invitedEmail: opts?.invitedEmail ?? `inv-${crypto.randomUUID()}@test.com`,
      inviteToken: token,
      inviteExpiresAt,
      role: opts?.role ?? "OPERATOR",
      status: "PENDING",
    },
  });

  return { ...row, token };
}

// Each test creates its own isolated company (via createTestAuthContext),
// so no global cleanup is needed — data is isolated by companyId.

describe("Invite Routes", () => {
  // ─── GET /api/invites/:token ──────────────────────────────────────────────

  describe("GET /api/invites/:token", () => {
    it("should return invite info for a valid PENDING invite (userExists: false)", async () => {
      const ctx = await createTestAuthContext({
        role: "ADMIN",
        companyName: "Loja Invite Test",
      });
      const invite = await createPendingInvite(ctx.companyId, {
        invitedEmail: `novo-${crypto.randomUUID()}@empresa.com`,
        role: "OPERATOR",
      });

      const res = await app.request(`/api/invites/${invite.token}`, {
        headers: h(),
      });
      const body = (await res.json()) as {
        success: true;
        data: {
          invitedEmail: string;
          role: string;
          companyName: string;
          inviteExpiresAt: string;
          userExists: boolean;
        };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.invitedEmail).toBe(invite.invitedEmail);
      expect(body.data.role).toBe("OPERATOR");
      expect(body.data.companyName).toBe("Loja Invite Test");
      expect(body.data.userExists).toBe(false);
      expect(typeof body.data.inviteExpiresAt).toBe("string");
    });

    it("should return userExists: true when the invited email already has an account", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const existing = await prisma.user.create({
        data: {
          email: `existing-${crypto.randomUUID()}@empresa.com`,
          password: "hashed",
        },
      });
      const invite = await createPendingInvite(ctx.companyId, {
        invitedEmail: existing.email,
      });

      const res = await app.request(`/api/invites/${invite.token}`, {
        headers: h(),
      });
      const body = (await res.json()) as { data: { userExists: boolean } };

      expect(res.status).toBe(200);
      expect(body.data.userExists).toBe(true);
    });

    it("should return 404 for an unknown token", async () => {
      const res = await app.request(
        `/api/invites/unknowntoken-${crypto.randomUUID()}`,
        { headers: h() },
      );
      expect(res.status).toBe(404);
    });

    it("should return 404 when the invite has already been accepted (token cleared)", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId);
      const rawToken = invite.token;
      const user = await prisma.user.create({
        data: {
          email: invite.invitedEmail!,
          password: "hashed",
        },
      });
      await prisma.membership.update({
        where: { id: invite.id },
        data: { userId: user.id, status: "ACTIVE", inviteToken: null },
      });

      const res = await app.request(`/api/invites/${rawToken}`, {
        headers: h(),
      });
      expect(res.status).toBe(404);
    });

    it("should return 410 for an expired invite", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId, {
        expired: true,
      });

      const res = await app.request(`/api/invites/${invite.token}`, {
        headers: h(),
      });
      expect(res.status).toBe(410);
    });
  });

  // ─── POST /api/invites/:token/accept — new user ───────────────────────────

  describe("POST /api/invites/:token/accept — new user", () => {
    it("should create account, activate membership and return a token pair", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId, {
        invitedEmail: `newuser-${crypto.randomUUID()}@empresa.com`,
        role: "OPERATOR",
      });

      const res = await app.request(`/api/invites/${invite.token}/accept`, {
        method: "POST",
        body: JSON.stringify({ name: "Novo Usuário", password: "senha123" }),
        headers: json(),
      });
      const body = (await res.json()) as {
        success: true;
        data: { token: string; refreshToken: string };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(typeof body.data.token).toBe("string");
      expect(typeof body.data.refreshToken).toBe("string");
    });

    it("should embed companyId and role in the access token payload", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId, {
        invitedEmail: `tokencheck-${crypto.randomUUID()}@empresa.com`,
        role: "VIEWER",
      });

      const res = await app.request(`/api/invites/${invite.token}/accept`, {
        method: "POST",
        body: JSON.stringify({ name: "Check User", password: "senha123" }),
        headers: json(),
      });
      const { data } = (await res.json()) as { data: { token: string } };
      const payload = (await verify(data.token, env.JWT_SECRET)) as {
        companyId: number;
        role: string;
      };

      expect(payload.companyId).toBe(ctx.companyId);
      expect(payload.role).toBe("VIEWER");
    });

    it("should mark the membership as ACTIVE and clear the invite token", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId, {
        invitedEmail: `activatecheck-${crypto.randomUUID()}@empresa.com`,
      });

      await app.request(`/api/invites/${invite.token}/accept`, {
        method: "POST",
        body: JSON.stringify({ name: "User", password: "senha123" }),
        headers: json(),
      });

      const row = await prisma.membership.findFirst({
        where: { id: invite.id },
      });
      expect(row?.status).toBe("ACTIVE");
      expect(row?.inviteToken).toBeNull();
    });

    it("should return 400 when name is missing for a brand-new user", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId, {
        invitedEmail: `noname-${crypto.randomUUID()}@empresa.com`,
      });

      const res = await app.request(`/api/invites/${invite.token}/accept`, {
        method: "POST",
        body: JSON.stringify({ password: "senha123" }),
        headers: json(),
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 for a password that fails validation rules", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId, {
        invitedEmail: `weakpw-${crypto.randomUUID()}@empresa.com`,
      });

      const res = await app.request(`/api/invites/${invite.token}/accept`, {
        method: "POST",
        body: JSON.stringify({ name: "User", password: "abc" }),
        headers: json(),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/invites/:token/accept — existing user ─────────────────────

  describe("POST /api/invites/:token/accept — existing user", () => {
    it("should activate membership for a user who already has an account", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const hashedPw = await Bun.password.hash("senha123");
      const user = await prisma.user.create({
        data: {
          email: `existente-${crypto.randomUUID()}@empresa.com`,
          password: hashedPw,
        },
      });
      const invite = await createPendingInvite(ctx.companyId, {
        invitedEmail: user.email,
      });

      const res = await app.request(`/api/invites/${invite.token}/accept`, {
        method: "POST",
        body: JSON.stringify({ password: "senha123" }),
        headers: json(),
      });
      const body = (await res.json()) as { success: boolean };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      const row = await prisma.membership.findFirst({
        where: { id: invite.id },
      });
      expect(row?.status).toBe("ACTIVE");
      expect(row?.userId).toBe(user.id);
    });

    it("should return 401 when the password is wrong for an existing user", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const hashedPw = await Bun.password.hash("correta123");
      const user = await prisma.user.create({
        data: {
          email: `wrongpw-${crypto.randomUUID()}@empresa.com`,
          password: hashedPw,
        },
      });
      const invite = await createPendingInvite(ctx.companyId, {
        invitedEmail: user.email,
      });

      const res = await app.request(`/api/invites/${invite.token}/accept`, {
        method: "POST",
        body: JSON.stringify({ password: "errada123" }),
        headers: json(),
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── Error / edge cases ───────────────────────────────────────────────────

  describe("POST /api/invites/:token/accept — error cases", () => {
    it("should return 404 for an invalid token", async () => {
      const res = await app.request(
        `/api/invites/badtoken-${crypto.randomUUID()}/accept`,
        {
          method: "POST",
          body: JSON.stringify({ name: "User", password: "senha123" }),
          headers: json(),
        },
      );
      expect(res.status).toBe(404);
    });

    it("should return 410 for an expired invite", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId, {
        invitedEmail: `expired-${crypto.randomUUID()}@empresa.com`,
        expired: true,
      });

      const res = await app.request(`/api/invites/${invite.token}/accept`, {
        method: "POST",
        body: JSON.stringify({ name: "User", password: "senha123" }),
        headers: json(),
      });
      expect(res.status).toBe(410);
    });

    it("should return 404 on a second accept attempt (token cleared after first use)", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId, {
        invitedEmail: `doubleaccept-${crypto.randomUUID()}@empresa.com`,
      });

      await app.request(`/api/invites/${invite.token}/accept`, {
        method: "POST",
        body: JSON.stringify({ name: "User", password: "senha123" }),
        headers: json(),
      });

      const res = await app.request(`/api/invites/${invite.token}/accept`, {
        method: "POST",
        body: JSON.stringify({ name: "User", password: "senha123" }),
        headers: json(),
      });
      expect(res.status).toBe(404);
    });
  });
});
