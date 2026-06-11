// Integration tests for member management endpoints (list, resend, change-role,
// revoke, remove). All endpoints live under /api/company/members and require
// the caller to have an ADMIN role.
//
// Each test creates its own isolated company via createTestAuthContext, so no
// global cleanup is needed — data is isolated by companyId.
import { describe, it, expect } from "bun:test";
import crypto from "crypto";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import { INVITE_TOKEN_TTL_MS } from "../../../config/constants";
import {
  createTestAuthContext,
  signTestToken,
} from "../../../test-utils/company";

// Unique IP per file to avoid rate-limit bucket collisions.
const IP = "127.0.0.31";
const h = (token: string) => ({
  "X-Forwarded-For": IP,
  Authorization: `Bearer ${token}`,
});
const json = (token: string) => ({
  ...h(token),
  "Content-Type": "application/json",
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createPendingInvite(companyId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  return prisma.membership.create({
    data: {
      companyId,
      invitedEmail: `inv-${crypto.randomUUID()}@test.com`,
      inviteToken: token,
      inviteExpiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
      role: "OPERATOR",
      status: "PENDING",
    },
  });
}

async function createActiveMember(
  companyId: number,
  role: "ADMIN" | "OPERATOR" | "VIEWER" = "OPERATOR",
) {
  const email = `member-${crypto.randomUUID()}@test.com`;
  const user = await prisma.user.create({
    data: { email, password: "hashed" },
  });
  const membership = await prisma.membership.create({
    data: { companyId, userId: user.id, role, status: "ACTIVE" },
  });
  return { user, membership };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Member Management Routes", () => {
  // ─── GET /api/company/members ────────────────────────────────────────────

  describe("GET /api/company/members", () => {
    it("should list all members (ACTIVE + PENDING) of the company", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      await createPendingInvite(ctx.companyId);
      await createActiveMember(ctx.companyId);

      const res = await app.request("/api/company/members", {
        headers: h(ctx.token),
      });
      const body = (await res.json()) as { success: boolean; data: unknown[] };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      // admin + pending invite + active operator = 3
      expect(body.data.length).toBe(3);
    });

    it("should return 401 without auth", async () => {
      const res = await app.request("/api/company/members", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 403 for an OPERATOR role (admin-only endpoint)", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const operatorToken = await signTestToken(
        ctx.userId,
        ctx.email,
        ctx.companyId,
        "OPERATOR",
      );
      const res = await app.request("/api/company/members", {
        headers: h(operatorToken),
      });
      expect(res.status).toBe(403);
    });

    it("should return 403 for a VIEWER role (admin-only endpoint)", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const viewerToken = await signTestToken(
        ctx.userId,
        ctx.email,
        ctx.companyId,
        "VIEWER",
      );
      const res = await app.request("/api/company/members", {
        headers: h(viewerToken),
      });
      expect(res.status).toBe(403);
    });

    it("should not expose members from a different company", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const otherCtx = await createTestAuthContext({
        companyName: "Other Corp",
      });
      await createActiveMember(otherCtx.companyId);

      const res = await app.request("/api/company/members", {
        headers: h(ctx.token),
      });
      const body = (await res.json()) as { data: unknown[] };

      expect(res.status).toBe(200);
      // Only the 1 member of ctx's company should appear
      expect(body.data.length).toBe(1);
    });
  });

  // ─── POST /api/company/members/invite ────────────────────────────────────

  describe("POST /api/company/members/invite", () => {
    it("should create an invite and return 201", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const res = await app.request("/api/company/members/invite", {
        method: "POST",
        body: JSON.stringify({
          email: `newmember-${crypto.randomUUID()}@empresa.com`,
          role: "OPERATOR",
        }),
        headers: json(ctx.token),
      });
      const body = (await res.json()) as { success: boolean };

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
    });

    it("should return 409 when the email is already an active member", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const { user } = await createActiveMember(ctx.companyId);

      const res = await app.request("/api/company/members/invite", {
        method: "POST",
        body: JSON.stringify({ email: user.email, role: "OPERATOR" }),
        headers: json(ctx.token),
      });
      expect(res.status).toBe(409);
    });

    it("should return 409 when a pending invite already exists for that email", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId);

      const res = await app.request("/api/company/members/invite", {
        method: "POST",
        body: JSON.stringify({ email: invite.invitedEmail, role: "OPERATOR" }),
        headers: json(ctx.token),
      });
      expect(res.status).toBe(409);
    });

    it("should return 403 for an OPERATOR (admin-only)", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const opToken = await signTestToken(
        ctx.userId,
        ctx.email,
        ctx.companyId,
        "OPERATOR",
      );
      const res = await app.request("/api/company/members/invite", {
        method: "POST",
        body: JSON.stringify({ email: "x@x.com", role: "OPERATOR" }),
        headers: json(opToken),
      });
      expect(res.status).toBe(403);
    });
  });

  // ─── POST /api/company/members/:id/resend ───────────────────────────────

  describe("POST /api/company/members/:id/resend", () => {
    it("should regenerate the invite token and return the new invite info", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId);
      const oldToken = invite.inviteToken;

      const res = await app.request(
        `/api/company/members/${invite.id}/resend`,
        { method: "POST", headers: h(ctx.token) },
      );
      expect(res.status).toBe(200);

      const updated = await prisma.membership.findFirst({
        where: { id: invite.id },
      });
      expect(updated?.inviteToken).not.toBe(oldToken);
    });

    it("should return 404 when the membership is not PENDING (e.g. ACTIVE)", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const { membership } = await createActiveMember(ctx.companyId);

      const res = await app.request(
        `/api/company/members/${membership.id}/resend`,
        { method: "POST", headers: h(ctx.token) },
      );
      expect(res.status).toBe(404);
    });

    it("should return 404 when the membership belongs to a different company", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const otherCtx = await createTestAuthContext({
        companyName: "Other Corp",
      });
      const invite = await createPendingInvite(otherCtx.companyId);

      const res = await app.request(
        `/api/company/members/${invite.id}/resend`,
        { method: "POST", headers: h(ctx.token) },
      );
      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /api/company/members/:id/role ────────────────────────────────

  describe("PATCH /api/company/members/:id/role", () => {
    it("should change the role of an active member", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const { membership } = await createActiveMember(
        ctx.companyId,
        "OPERATOR",
      );

      const res = await app.request(
        `/api/company/members/${membership.id}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: "VIEWER" }),
          headers: json(ctx.token),
        },
      );
      const body = (await res.json()) as { data: { role: string } };

      expect(res.status).toBe(200);
      expect(body.data.role).toBe("VIEWER");
    });

    it("should return 409 when trying to demote the last admin", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const adminMembership = await prisma.membership.findFirst({
        where: { userId: ctx.userId, companyId: ctx.companyId },
      });

      const res = await app.request(
        `/api/company/members/${adminMembership!.id}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: "OPERATOR" }),
          headers: json(ctx.token),
        },
      );
      expect(res.status).toBe(409);
    });

    it("should allow promoting a member to ADMIN", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const { membership } = await createActiveMember(
        ctx.companyId,
        "OPERATOR",
      );

      const res = await app.request(
        `/api/company/members/${membership.id}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: "ADMIN" }),
          headers: json(ctx.token),
        },
      );
      expect(res.status).toBe(200);
    });

    it("should return 404 when the membership is PENDING (not ACTIVE)", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId);

      const res = await app.request(`/api/company/members/${invite.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: "VIEWER" }),
        headers: json(ctx.token),
      });
      expect(res.status).toBe(404);
    });

    it("should return 403 for an OPERATOR (admin-only)", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const { membership } = await createActiveMember(
        ctx.companyId,
        "OPERATOR",
      );
      const opToken = await signTestToken(
        ctx.userId,
        ctx.email,
        ctx.companyId,
        "OPERATOR",
      );

      const res = await app.request(
        `/api/company/members/${membership.id}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: "VIEWER" }),
          headers: json(opToken),
        },
      );
      expect(res.status).toBe(403);
    });
  });

  // ─── PATCH /api/company/members/:id/revoke ──────────────────────────────

  describe("PATCH /api/company/members/:id/revoke", () => {
    it("should revoke access of an active member", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const { membership } = await createActiveMember(ctx.companyId);

      const res = await app.request(
        `/api/company/members/${membership.id}/revoke`,
        { method: "PATCH", headers: h(ctx.token) },
      );
      const body = (await res.json()) as { data: { status: string } };

      expect(res.status).toBe(200);
      expect(body.data.status).toBe("REVOKED");
    });

    it("should return 409 when trying to revoke self", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const adminMembership = await prisma.membership.findFirst({
        where: { userId: ctx.userId, companyId: ctx.companyId },
      });

      const res = await app.request(
        `/api/company/members/${adminMembership!.id}/revoke`,
        { method: "PATCH", headers: h(ctx.token) },
      );
      expect(res.status).toBe(409);
    });

    it("should return 404 when the membership is PENDING (not ACTIVE)", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId);

      const res = await app.request(
        `/api/company/members/${invite.id}/revoke`,
        { method: "PATCH", headers: h(ctx.token) },
      );
      expect(res.status).toBe(404);
    });

    it("should return 403 for an OPERATOR (admin-only)", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const { membership } = await createActiveMember(ctx.companyId);
      const opToken = await signTestToken(
        ctx.userId,
        ctx.email,
        ctx.companyId,
        "OPERATOR",
      );

      const res = await app.request(
        `/api/company/members/${membership.id}/revoke`,
        { method: "PATCH", headers: h(opToken) },
      );
      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE /api/company/members/:id ────────────────────────────────────

  describe("DELETE /api/company/members/:id", () => {
    it("should permanently remove an active member", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const { membership } = await createActiveMember(ctx.companyId);

      const res = await app.request(`/api/company/members/${membership.id}`, {
        method: "DELETE",
        headers: h(ctx.token),
      });
      const body = (await res.json()) as { success: boolean };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      const gone = await prisma.membership.findFirst({
        where: { id: membership.id },
      });
      expect(gone).toBeNull();
    });

    it("should permanently remove a PENDING invite", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const invite = await createPendingInvite(ctx.companyId);

      const res = await app.request(`/api/company/members/${invite.id}`, {
        method: "DELETE",
        headers: h(ctx.token),
      });
      expect(res.status).toBe(200);

      const gone = await prisma.membership.findFirst({
        where: { id: invite.id },
      });
      expect(gone).toBeNull();
    });

    it("should return 409 when trying to remove self", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const adminMembership = await prisma.membership.findFirst({
        where: { userId: ctx.userId, companyId: ctx.companyId },
      });

      const res = await app.request(
        `/api/company/members/${adminMembership!.id}`,
        { method: "DELETE", headers: h(ctx.token) },
      );
      expect(res.status).toBe(409);
    });

    it("should return 404 when the membership belongs to a different company", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const otherCtx = await createTestAuthContext({
        companyName: "Other Corp",
      });
      const { membership } = await createActiveMember(otherCtx.companyId);

      const res = await app.request(`/api/company/members/${membership.id}`, {
        method: "DELETE",
        headers: h(ctx.token),
      });
      expect(res.status).toBe(404);
    });

    it("should return 403 for an OPERATOR (admin-only)", async () => {
      const ctx = await createTestAuthContext({ role: "ADMIN" });
      const { membership } = await createActiveMember(ctx.companyId);
      const opToken = await signTestToken(
        ctx.userId,
        ctx.email,
        ctx.companyId,
        "OPERATOR",
      );

      const res = await app.request(`/api/company/members/${membership.id}`, {
        method: "DELETE",
        headers: h(opToken),
      });
      expect(res.status).toBe(403);
    });
  });
});
