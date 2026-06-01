// Global error handler: maps known errors to appropriate HTTP responses
import { HTTPException } from "hono/http-exception";
import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { PrismaClientKnownRequestError } from "../../generated/prisma/runtime/client";
import { env } from "../config/env";

export const errorHandler: ErrorHandler = (err, c) => {
  // Zod validation errors
  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: "Validation error",
        details: err.issues.map((e) => ({
          path: e.path.map(String).join("."), // Convert array indices to string
          message: e.message,
        })),
      },
      400,
    );
  }

  // Hono HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        error: err.message,
      },
      err.status,
    );
  }

  // Prisma known request errors (P2002, P2025, etc.)
  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const meta = err.meta as { target?: string[] } | undefined;
      const field = meta?.target?.[0] ?? "Field";
      return c.json({ success: false, error: `${field} already in use` }, 409);
    }

    if (err.code === "P2025") {
      return c.json({ success: false, error: "Record not found" }, 404);
    }
  }

  // Unexpected server errors
  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorStack = err instanceof Error ? err.stack : undefined;

  const requestId = c.get("requestId" as never) as string | undefined;
  console.error(
    JSON.stringify({
      requestId,
      error: errorStack || errorMessage,
      timestamp: new Date().toISOString(),
    }),
  );
  return c.json(
    {
      success: false,
      error: "Internal server error",
      message: env.NODE_ENV === "development" ? errorMessage : undefined,
    },
    500,
  );
};
