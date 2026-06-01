// Unit tests for the rate limiting middleware
import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { rateLimitMiddleware } from "../rate-limit";

// Each test uses a unique X-Forwarded-For IP to avoid interference
// with the shared in-memory `requests` Map across the test suite.
let ipCounter = 0;
function uniqueIp() {
  return `192.0.2.${++ipCounter}`;
}

function createApp(maxRequests: number, windowMs = 60_000) {
  const app = new Hono();
  app.use("*", rateLimitMiddleware(maxRequests, windowMs));
  app.get("/", (c) => c.json({ ok: true }));
  return app;
}

describe("rateLimitMiddleware", () => {
  it("should allow requests within the limit", async () => {
    const app = createApp(3);
    const ip = uniqueIp();

    const res = await app.request("/", {
      headers: { "x-forwarded-for": ip },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("should return 429 after exceeding the request limit", async () => {
    const app = createApp(2);
    const ip = uniqueIp();
    const opts = { headers: { "x-forwarded-for": ip } };

    await app.request("/", opts); // 1st — allowed
    await app.request("/", opts); // 2nd — allowed
    const res = await app.request("/", opts); // 3rd — blocked

    expect(res.status).toBe(429);
  });

  it("should return correct error body on 429", async () => {
    const app = createApp(1);
    const ip = uniqueIp();
    const opts = { headers: { "x-forwarded-for": ip } };

    await app.request("/", opts); // consume the 1 allowed request
    const res = await app.request("/", opts); // blocked

    const body = (await res.json()) as {
      success: boolean;
      error: string;
      message: string;
    };

    expect(body.success).toBe(false);
    expect(body.error).toBe("Too many requests");
    expect(typeof body.message).toBe("string");
    expect(body.message).toContain("1");
  });

  it("should track different IPs independently", async () => {
    const app = createApp(1);
    const ipA = uniqueIp();
    const ipB = uniqueIp();

    // Exhaust ip A's quota
    await app.request("/", { headers: { "x-forwarded-for": ipA } });
    const blockedA = await app.request("/", {
      headers: { "x-forwarded-for": ipA },
    });
    expect(blockedA.status).toBe(429);

    // ip B is a fresh bucket — must still be allowed
    const allowedB = await app.request("/", {
      headers: { "x-forwarded-for": ipB },
    });
    expect(allowedB.status).toBe(200);
  });

  it("should prefer x-forwarded-for over cf-connecting-ip when both are present", async () => {
    const app = createApp(1);
    // Use distinct IPs so they get independent buckets
    const cfIp = uniqueIp();
    const fwdIp = uniqueIp();

    // First request uses cfIp (from cf-connecting-ip)
    await app.request("/", {
      headers: {
        "x-forwarded-for": fwdIp,
        "cf-connecting-ip": cfIp,
      },
    });

    // Second request with the same cfIp — should be rate-limited
    const res = await app.request("/", {
      headers: {
        "x-forwarded-for": uniqueIp(), // different fwd IP
        "cf-connecting-ip": cfIp,
      },
    });

    // x-forwarded-for takes priority in the current implementation
    // (cf-connecting-ip is only used as fallback when x-forwarded-for is absent)
    // so the second request is in a fresh fwd bucket and must pass
    expect(res.status).toBe(200);
  });

  it("should fall back to 'unknown' bucket when no IP header is present", async () => {
    // Use a very high limit so the shared 'unknown' bucket from other
    // integration tests running in the same process does not interfere
    const app = createApp(10_000);

    const res = await app.request("/");

    expect(res.status).toBe(200);
  });
});
