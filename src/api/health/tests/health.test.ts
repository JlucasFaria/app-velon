// Integration tests for the health check endpoint
import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import app from "../../../../src/index";
import { createHealthRoutes } from "../health-routes";
import type { PrismaClient } from "../../../../generated/prisma";

describe("Smoke tests", () => {
  it("should return a JSON 404 for an unknown API route", async () => {
    const res = await app.request("/api/does-not-exist");

    expect(res.status).toBe(404);
    const body = (await res.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe("Not Found");
  });

  it("should return 200 for GET /ui", async () => {
    const res = await app.request("/ui");

    expect(res.status).toBe(200);
  });

  it("should return 200 with a valid OpenAPI spec for GET /doc", async () => {
    const res = await app.request("/doc");
    const body = (await res.json()) as { openapi: string };

    expect(res.status).toBe(200);
    expect(body.openapi).toBe("3.0.0");
  });
});

describe("GET /health", () => {
  it("should return 200 with status ok when database is connected", async () => {
    const res = await app.request("/health");

    const body = (await res.json()) as {
      status: string;
      timestamp: string;
      database: string;
    };

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
  });

  it("should return a valid ISO 8601 timestamp", async () => {
    const res = await app.request("/health");

    const body = (await res.json()) as { timestamp: string };

    // new Date() on an invalid string produces "Invalid Date"
    expect(new Date(body.timestamp).toString()).not.toBe("Invalid Date");
  });

  // NOTE: The 503 scenario is tested in a dedicated describe block below using
  // dependency injection — a failing prisma is passed to createHealthRoutes().
});

describe("GET /health — 503 scenario", () => {
  // createHealthRoutes accepts an optional PrismaClient for dependency injection.
  // We pass a minimal mock that always rejects, simulating a DB outage.
  const failingPrisma = {
    $queryRaw: () => Promise.reject(new Error("DB connection failed")),
  } as unknown as PrismaClient;

  const testApp = new Hono();
  testApp.route("/health", createHealthRoutes(failingPrisma));

  it("should return 503 when the database is unreachable", async () => {
    const res = await testApp.request("/health");

    expect(res.status).toBe(503);
  });

  it("should return status 'error' and database 'disconnected' when DB is down", async () => {
    const res = await testApp.request("/health");
    const body = (await res.json()) as {
      status: string;
      database: string;
      timestamp: string;
    };

    expect(body.status).toBe("error");
    expect(body.database).toBe("disconnected");
    expect(new Date(body.timestamp).toString()).not.toBe("Invalid Date");
  });
});

describe("GET /health — CORS headers", () => {
  it("should include Access-Control-Allow-Origin when Origin header is sent", async () => {
    const res = await app.request("/health", {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).not.toBeNull();
  });
});

describe("GET /health — security headers", () => {
  it("should include X-Content-Type-Options: nosniff", async () => {
    const res = await app.request("/health");

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("should include X-Frame-Options", async () => {
    const res = await app.request("/health");

    expect(res.headers.get("X-Frame-Options")).not.toBeNull();
  });
});
