import type { MiddlewareHandler } from "hono";
import { randomBytes } from "crypto";

export type RequestIdVariables = { requestId: string };

export const requestIdMiddleware: MiddlewareHandler<{
  Variables: RequestIdVariables;
}> = async (c, next) => {
  const requestId = randomBytes(8).toString("hex");
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  await next();
};
