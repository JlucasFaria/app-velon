import { existsSync } from "fs";
import { describe, it, expect } from "bun:test";
import app from "../../../../src/index";
import prisma from "../../../db/client";
import {
  createTestAuthContext,
  signTestToken,
} from "../../../test-utils/company";

// Valid file signatures (magic bytes) for the upload tests.
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG_BYTES = [0xff, 0xd8, 0xff, 0xe0];

// Unique IP to isolate the rate-limit bucket from other test files.
const IP = "127.0.0.20";

const h = (token: string, extra?: Record<string, string>) => ({
  "X-Forwarded-For": IP,
  Authorization: `Bearer ${token}`,
  ...extra,
});

const json = (token: string) =>
  h(token, { "Content-Type": "application/json" });

describe("Company Routes", () => {
  // ─── Auth guard ───────────────────────────────────────────────────

  describe("auth guard", () => {
    it("should return 401 on GET /api/company without token", async () => {
      const res = await app.request("/api/company", {
        headers: { "X-Forwarded-For": IP },
      });
      expect(res.status).toBe(401);
    });

    it("should return 403 when the user has no company configured", async () => {
      const token = await signTestToken(1, "nobody@test.com", null, null);
      const res = await app.request("/api/company", { headers: h(token) });
      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/company ─────────────────────────────────────────────

  describe("GET /api/company", () => {
    it("should return the caller's current company", async () => {
      const { token, companyId } = await createTestAuthContext({
        companyName: "Minha Loja",
      });

      const res = await app.request("/api/company", { headers: h(token) });
      const body = (await res.json()) as {
        success: boolean;
        data: { id: number; name: string };
      };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(companyId);
      expect(body.data.name).toBe("Minha Loja");
    });
  });

  // ─── PATCH /api/company ───────────────────────────────────────────

  describe("PATCH /api/company", () => {
    it("should update company fields", async () => {
      const { token } = await createTestAuthContext();

      const res = await app.request("/api/company", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Novo Nome",
          document: "12.345.678/0001-90",
        }),
        headers: json(token),
      });
      const body = (await res.json()) as {
        data: { name: string; document: string };
      };

      expect(res.status).toBe(200);
      expect(body.data.name).toBe("Novo Nome");
      expect(body.data.document).toBe("12.345.678/0001-90");
    });

    it("should return 400 on an invalid email", async () => {
      const { token } = await createTestAuthContext();

      const res = await app.request("/api/company", {
        method: "PATCH",
        body: JSON.stringify({ email: "not-an-email" }),
        headers: json(token),
      });

      expect(res.status).toBe(400);
    });

    it("should scope updates to the caller's company", async () => {
      const a = await createTestAuthContext({ companyName: "Company A" });
      const b = await createTestAuthContext({ companyName: "Company B" });

      await app.request("/api/company", {
        method: "PATCH",
        body: JSON.stringify({ name: "A renamed" }),
        headers: json(a.token),
      });

      // Company B must be untouched by A's update.
      const res = await app.request("/api/company", { headers: h(b.token) });
      const body = (await res.json()) as { data: { name: string } };

      expect(body.data.name).toBe("Company B");
    });

    it("should clear an optional field when sent as null", async () => {
      const { token } = await createTestAuthContext();

      await app.request("/api/company", {
        method: "PATCH",
        body: JSON.stringify({ phone: "(11) 9999-0000" }),
        headers: json(token),
      });

      const res = await app.request("/api/company", {
        method: "PATCH",
        body: JSON.stringify({ phone: null }),
        headers: json(token),
      });
      const body = (await res.json()) as { data: { phone: string | null } };

      expect(res.status).toBe(200);
      expect(body.data.phone).toBeNull();
    });
  });

  // ─── POST /api/company/logo ───────────────────────────────────────

  describe("POST /api/company/logo", () => {
    const uploadLogo = (
      token: string,
      bytes: number[],
      name: string,
      type: string,
    ) => {
      const form = new FormData();
      form.append("logo", new File([new Uint8Array(bytes)], name, { type }));
      return app.request("/api/company/logo", {
        method: "POST",
        body: form,
        headers: h(token),
      });
    };

    it("should accept a PNG and store its url", async () => {
      const { token } = await createTestAuthContext();

      const res = await uploadLogo(token, PNG_BYTES, "logo.png", "image/png");
      const body = (await res.json()) as { data: { logoUrl: string } };

      expect(res.status).toBe(200);
      expect(body.data.logoUrl).toMatch(
        /^\/api\/uploads\/logos\/company-\d+-\d+\.png$/,
      );
    });

    it("should return 400 for an unsupported format", async () => {
      const { token } = await createTestAuthContext();

      const res = await uploadLogo(token, [1, 2, 3], "logo.gif", "image/gif");

      expect(res.status).toBe(400);
    });

    it("should reject a non-image whose Content-Type claims to be PNG", async () => {
      const { token } = await createTestAuthContext();

      // Spoofed type: header says image/png but the bytes are not a PNG.
      const res = await uploadLogo(
        token,
        [1, 2, 3, 4],
        "fake.png",
        "image/png",
      );

      expect(res.status).toBe(400);
    });

    it("should delete the previous logo file when replaced", async () => {
      const { token } = await createTestAuthContext();

      const first = (await (
        await uploadLogo(token, PNG_BYTES, "a.png", "image/png")
      ).json()) as { data: { logoUrl: string } };
      const firstPath = `uploads/${first.data.logoUrl.split("/uploads/")[1]}`;
      expect(existsSync(firstPath)).toBe(true);

      await uploadLogo(token, JPG_BYTES, "b.jpg", "image/jpeg");

      expect(existsSync(firstPath)).toBe(false);
    });

    it("should return 400 when no file field is present", async () => {
      const { token } = await createTestAuthContext();

      const form = new FormData();
      form.append("notlogo", "hello");

      const res = await app.request("/api/company/logo", {
        method: "POST",
        body: form,
        headers: h(token),
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/company/setup ──────────────────────────────────────

  describe("POST /api/company/setup", () => {
    it("should return 201 and create company + ADMIN membership for a user without a company", async () => {
      const user = await prisma.user.create({
        data: {
          email: `setup-${crypto.randomUUID()}@test.com`,
          password: "hashed",
        },
      });
      const token = await signTestToken(user.id, user.email, null, null);

      const res = await app.request("/api/company/setup", {
        method: "POST",
        body: JSON.stringify({ name: "Minha Empresa" }),
        headers: json(token),
      });
      const body = (await res.json()) as { data: { id: number; name: string } };

      expect(res.status).toBe(201);
      expect(body.data.name).toBe("Minha Empresa");

      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, status: "ACTIVE", role: "ADMIN" },
      });
      expect(membership).not.toBeNull();
      expect(membership!.companyId).toBe(body.data.id);
    });

    it("should return 409 when user already has a company in the JWT", async () => {
      const { token } = await createTestAuthContext();

      const res = await app.request("/api/company/setup", {
        method: "POST",
        body: JSON.stringify({ name: "Segunda Empresa" }),
        headers: json(token),
      });

      expect(res.status).toBe(409);
    });

    it("should return 409 on a second setup with a stale (companyId: null) token, without creating a second company", async () => {
      const user = await prisma.user.create({
        data: {
          email: `setup-stale-${crypto.randomUUID()}@test.com`,
          password: "hashed",
        },
      });
      // Token still carries companyId: null — simulates a user who completed
      // setup but never refreshed their access token.
      const token = await signTestToken(user.id, user.email, null, null);

      const first = await app.request("/api/company/setup", {
        method: "POST",
        body: JSON.stringify({ name: "Primeira Empresa" }),
        headers: json(token),
      });
      expect(first.status).toBe(201);

      const second = await app.request("/api/company/setup", {
        method: "POST",
        body: JSON.stringify({ name: "Segunda Empresa" }),
        headers: json(token),
      });
      const body = (await second.json()) as { error: string };

      expect(second.status).toBe(409);
      expect(body.error).toBe("Empresa já configurada para este usuário");

      // The DB guard must have prevented a second company + membership.
      const memberships = await prisma.membership.count({
        where: { userId: user.id },
      });
      expect(memberships).toBe(1);
    });

    it("should return 400 when name is missing", async () => {
      const user = await prisma.user.create({
        data: {
          email: `setup-${crypto.randomUUID()}@test.com`,
          password: "hashed",
        },
      });
      const token = await signTestToken(user.id, user.email, null, null);

      const res = await app.request("/api/company/setup", {
        method: "POST",
        body: JSON.stringify({}),
        headers: json(token),
      });

      expect(res.status).toBe(400);
    });

    it("should return 401 without a token", async () => {
      const res = await app.request("/api/company/setup", {
        method: "POST",
        body: JSON.stringify({ name: "Test" }),
        headers: { "X-Forwarded-For": IP, "Content-Type": "application/json" },
      });

      expect(res.status).toBe(401);
    });
  });
});
