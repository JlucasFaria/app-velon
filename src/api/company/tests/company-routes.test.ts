import { describe, it, expect } from "bun:test";
import app from "../../../../src/index";
import {
  createTestAuthContext,
  signTestToken,
} from "../../../test-utils/company";

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
    it("should accept a PNG and store its url", async () => {
      const { token } = await createTestAuthContext();

      const form = new FormData();
      const png = new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
        "logo.png",
        {
          type: "image/png",
        },
      );
      form.append("logo", png);

      const res = await app.request("/api/company/logo", {
        method: "POST",
        body: form,
        headers: h(token),
      });
      const body = (await res.json()) as { data: { logoUrl: string } };

      expect(res.status).toBe(200);
      expect(body.data.logoUrl).toMatch(
        /^\/api\/uploads\/logos\/company-\d+-\d+\.png$/,
      );
    });

    it("should return 400 for an unsupported format", async () => {
      const { token } = await createTestAuthContext();

      const form = new FormData();
      form.append(
        "logo",
        new File([new Uint8Array([1, 2, 3])], "logo.gif", {
          type: "image/gif",
        }),
      );

      const res = await app.request("/api/company/logo", {
        method: "POST",
        body: form,
        headers: h(token),
      });

      expect(res.status).toBe(400);
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
});
