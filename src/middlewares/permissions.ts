import { HTTPException } from "hono/http-exception";
import type { MiddlewareHandler } from "hono";
import type { Role } from "../../generated/prisma";
import { getCompanyContext, type AuthVariables } from "./auth";

// Numeric rank for each role so comparison is a single integer check.
export const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 0,
  OPERATOR: 1,
  ADMIN: 2,
};

// Returns a middleware that throws 403 when the caller's role is below
// minRole. Must run after authMiddleware (needs jwtPayload in context).
export function requireMinRole(
  minRole: Role,
): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const { role } = getCompanyContext(c);
    if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) {
      throw new HTTPException(403, { message: "Permissão insuficiente" });
    }
    await next();
  };
}
