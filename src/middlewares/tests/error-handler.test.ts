// Unit tests for the global error handler middleware
import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { PrismaClientKnownRequestError } from "../../../generated/prisma/runtime/client";
import { errorHandler } from "../error-handler";

// Creates a minimal Hono app that throws the supplied error and routes it
// through the global error handler — mirrors how errors propagate in production.
function makeApp(errFactory: () => unknown) {
  const app = new Hono();
  app.onError(errorHandler);
  app.get("/", () => {
    throw errFactory();
  });
  return app;
}

function makeZodError() {
  const result = z.string().safeParse(123);
  if (!result.success) return result.error;
  throw new Error("Expected safeParse to fail");
}

describe("errorHandler", () => {
  // ─── ZodError ────────────────────────────────────────────────────

  it("should return 400 for a ZodError", async () => {
    const app = makeApp(makeZodError);
    const res = await app.request("/");

    expect(res.status).toBe(400);
  });

  it("should return success:false and 'Validation error' for a ZodError", async () => {
    const app = makeApp(makeZodError);
    const body = (await (await app.request("/")).json()) as {
      success: boolean;
      error: string;
      details: Array<{ path: string; message: string }>;
    };

    expect(body.success).toBe(false);
    expect(body.error).toBe("Validation error");
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
  });

  // ─── HTTPException ───────────────────────────────────────────────

  it("should forward the HTTPException status code", async () => {
    const app = makeApp(() => new HTTPException(403, { message: "Forbidden" }));
    const res = await app.request("/");

    expect(res.status).toBe(403);
  });

  it("should return the HTTPException message in the body", async () => {
    const app = makeApp(
      () => new HTTPException(422, { message: "Unprocessable" }),
    );
    const body = (await (await app.request("/")).json()) as {
      success: boolean;
      error: string;
    };

    expect(body.success).toBe(false);
    expect(body.error).toBe("Unprocessable");
  });

  // ─── Prisma P2002 (unique constraint) ────────────────────────────

  it("should return 409 for a Prisma P2002 error", async () => {
    const app = makeApp(
      () =>
        new PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "5.0.0",
          meta: { target: ["email"] },
        }),
    );
    const res = await app.request("/");

    expect(res.status).toBe(409);
  });

  it("should include the conflicting field name in the P2002 error message", async () => {
    const app = makeApp(
      () =>
        new PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "5.0.0",
          meta: { target: ["email"] },
        }),
    );
    const body = (await (await app.request("/")).json()) as {
      success: boolean;
      error: string;
    };

    expect(body.success).toBe(false);
    expect(body.error).toBe("email already in use");
  });

  // ─── Prisma P2025 (record not found) ─────────────────────────────

  it("should return 404 for a Prisma P2025 error", async () => {
    const app = makeApp(
      () =>
        new PrismaClientKnownRequestError("Record not found", {
          code: "P2025",
          clientVersion: "5.0.0",
        }),
    );
    const res = await app.request("/");

    expect(res.status).toBe(404);
  });

  it("should return 'Record not found' message for a P2025 error", async () => {
    const app = makeApp(
      () =>
        new PrismaClientKnownRequestError("Record not found", {
          code: "P2025",
          clientVersion: "5.0.0",
        }),
    );
    const body = (await (await app.request("/")).json()) as {
      success: boolean;
      error: string;
    };

    expect(body.success).toBe(false);
    expect(body.error).toBe("Record not found");
  });

  // ─── Unknown / generic errors ─────────────────────────────────────

  it("should return 500 for an unknown error", async () => {
    const app = makeApp(() => new Error("Unexpected failure"));
    const res = await app.request("/");

    expect(res.status).toBe(500);
  });

  it("should hide the error message in non-development environments", async () => {
    const app = makeApp(() => new Error("Sensitive detail"));
    const body = (await (await app.request("/")).json()) as {
      success: boolean;
      error: string;
      message?: string;
    };

    expect(body.success).toBe(false);
    expect(body.error).toBe("Internal server error");
    // NODE_ENV in tests is "test", not "development", so message must be hidden
    expect(body.message).toBeUndefined();
  });
});
