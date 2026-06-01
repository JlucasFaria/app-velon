import { verify } from "hono/jwt";
import { HTTPException } from "hono/http-exception";
import { env } from "../config/env";
import type { Context, MiddlewareHandler } from "hono";

export type AuthVariables = {
  jwtPayload: {
    id: number;
    email: string;
    exp: number;
  };
};

// In-memory access token blacklist: token → expiry timestamp (ms).
// Entries are added on logout and auto-removed when the token naturally expires.
// NOTE: Cleared on server restart — use Redis for persistent revocation.
const tokenBlacklist = new Map<string, number>();

export function blacklistToken(token: string, expSeconds: number): void {
  tokenBlacklist.set(token, expSeconds * 1000);
}

// Periodically remove expired entries to prevent unbounded memory growth
export const tokenBlacklistCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [token, expMs] of tokenBlacklist) {
    if (expMs <= now) tokenBlacklist.delete(token);
  }
}, 60_000);

export const authMiddleware: MiddlewareHandler<{
  Variables: AuthVariables;
}> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const token = authHeader.slice(7);

  let payload: AuthVariables["jwtPayload"];
  try {
    payload = (await verify(
      token,
      env.JWT_SECRET,
    )) as AuthVariables["jwtPayload"];
  } catch {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  if (tokenBlacklist.has(token)) {
    throw new HTTPException(401, { message: "Token has been revoked" });
  }

  c.set("jwtPayload", payload);
  await next();
};

// Helper to extract the JWT payload in a type-safe way
export function getAuthPayload(c: Context<{ Variables: AuthVariables }>) {
  return c.get("jwtPayload");
}
