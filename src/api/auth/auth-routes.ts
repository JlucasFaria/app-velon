// Authentication routes: login, refresh token, and logout
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { sign, verify } from "hono/jwt";
import { PrismaClientKnownRequestError } from "../../../generated/prisma/runtime/client";
import type { Role } from "../../../generated/prisma";
import { env } from "../../config/env";
import { blacklistToken } from "../../middlewares/auth";
import { ACCESS_TOKEN_TTL_SECONDS } from "../../config/constants";
import { AuthService } from "./auth-service";
import {
  loginSchema,
  authResponseSchema,
  refreshTokenSchema,
  logoutResponseSchema,
} from "./auth-schema";
import {
  errorResponseSchema,
  validationErrorResponseSchema,
} from "../../schemas/response";
import { successResponse, errorResponse } from "../../utils/response";

// Minimal interface — auth only needs these two methods from the user domain.
// Using an interface instead of importing UserService directly keeps this module
// decoupled from the user implementation and easier to test in isolation.
export interface IUserAuthRepository {
  findByEmail(
    email: string,
  ): Promise<{ id: number; email: string; password: string } | null>;
  verifyPassword(hash: string, password: string): Promise<boolean>;
  // Active company membership used to scope the access token. Null when the
  // user has not yet joined/created a company (pre-onboarding).
  getActiveMembership(
    userId: number,
  ): Promise<{ companyId: number; role: Role } | null>;
}

// === Factory function ===
// Receives a userRepo and an optional authService (defaults to a new AuthService).
// Wiring with concrete implementations happens at the composition root (index.ts).
export function createAuthRoutes(
  userRepo: IUserAuthRepository,
  authService: AuthService = new AuthService(),
) {
  const authRoutes = new OpenAPIHono();

  async function generateAccessToken(
    user: { id: number; email: string },
    membership: { companyId: number; role: Role } | null,
  ) {
    const payload = {
      id: user.id,
      email: user.email,
      companyId: membership?.companyId ?? null,
      role: membership?.role ?? null,
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
    };
    return await sign(payload, env.JWT_SECRET);
  }

  // === Route Definitions ===

  const loginRoute = createRoute({
    method: "post",
    path: "/login",
    tags: ["Auth"],
    request: {
      body: {
        content: { "application/json": { schema: loginSchema } },
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: authResponseSchema } },
        description: "Login successful, returns access and refresh tokens",
      },
      400: {
        content: {
          "application/json": { schema: validationErrorResponseSchema },
        },
        description: "Validation error",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Invalid credentials",
      },
    },
  });

  const refreshRoute = createRoute({
    method: "post",
    path: "/refresh",
    tags: ["Auth"],
    request: {
      body: {
        content: { "application/json": { schema: refreshTokenSchema } },
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: authResponseSchema } },
        description: "Tokens refreshed successfully",
      },
      400: {
        content: {
          "application/json": { schema: validationErrorResponseSchema },
        },
        description: "Validation error",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Invalid or expired refresh token",
      },
    },
  });

  const logoutRoute = createRoute({
    method: "post",
    path: "/logout",
    tags: ["Auth"],
    request: {
      body: {
        content: { "application/json": { schema: refreshTokenSchema } },
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: logoutResponseSchema } },
        description: "Logout successful, refresh token revoked",
      },
      400: {
        content: {
          "application/json": { schema: validationErrorResponseSchema },
        },
        description: "Validation error",
      },
    },
  });

  // === Login Handler ===
  authRoutes.openapi(loginRoute, async (c) => {
    const { email, password } = c.req.valid("json");

    const user = await userRepo.findByEmail(email);

    if (!user) {
      return errorResponse(c, "Invalid credentials", 401);
    }

    const isValid = await userRepo.verifyPassword(user.password, password);

    if (!isValid) {
      return errorResponse(c, "Invalid credentials", 401);
    }

    const membership = await userRepo.getActiveMembership(user.id);
    const accessToken = await generateAccessToken(user, membership);
    const refreshToken = await authService.generateRefreshToken(user.id);

    return successResponse(
      c,
      { token: accessToken, refreshToken },
      200,
      "Login successful",
    );
  });

  // === Refresh Handler ===
  authRoutes.openapi(refreshRoute, async (c) => {
    const { refreshToken } = c.req.valid("json");

    const storedToken = await authService.validateRefreshToken(refreshToken);

    if (!storedToken) {
      return errorResponse(c, "Invalid or expired refresh token", 401);
    }

    const newRefreshToken = await authService.rotateRefreshToken(
      refreshToken,
      storedToken.userId,
    );
    const membership = await userRepo.getActiveMembership(storedToken.userId);
    const accessToken = await generateAccessToken(storedToken.user, membership);

    return successResponse(
      c,
      { token: accessToken, refreshToken: newRefreshToken },
      200,
      "Tokens refreshed successfully",
    );
  });

  // === Logout Handler ===
  authRoutes.openapi(logoutRoute, async (c) => {
    const { refreshToken } = c.req.valid("json");

    try {
      await authService.revokeRefreshToken(refreshToken);
    } catch (err) {
      // P2025 = record not found — token already gone, treat as logged out
      if (
        !(err instanceof PrismaClientKnownRequestError && err.code === "P2025")
      ) {
        throw err;
      }
    }

    // Blacklist the access token so it cannot be used after logout.
    // Best-effort: if the header is absent or the token is already expired, skip.
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const accessToken = authHeader.slice(7);
      try {
        const payload = (await verify(accessToken, env.JWT_SECRET)) as {
          exp: number;
        };
        blacklistToken(accessToken, payload.exp);
      } catch {
        // Token invalid or expired — nothing to blacklist
      }
    }

    return successResponse(c, { message: "Logged out successfully" }, 200);
  });

  return authRoutes;
}
