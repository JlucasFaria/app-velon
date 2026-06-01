// Unit tests for the request-id middleware
import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { requestIdMiddleware } from "../request-id";

const app = new Hono();
app.use("*", requestIdMiddleware);
app.get("/", (c) => c.json({ ok: true }));

describe("requestIdMiddleware", () => {
  it("should add an X-Request-ID header to every response", async () => {
    const res = await app.request("/");

    expect(res.headers.get("X-Request-ID")).not.toBeNull();
  });

  it("should generate a 16-character lowercase hex string", async () => {
    const res = await app.request("/");
    const id = res.headers.get("X-Request-ID");

    // 8 random bytes → 16 hex chars
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("should generate a unique ID for each request", async () => {
    const res1 = await app.request("/");
    const res2 = await app.request("/");

    expect(res1.headers.get("X-Request-ID")).not.toBe(
      res2.headers.get("X-Request-ID"),
    );
  });
});
