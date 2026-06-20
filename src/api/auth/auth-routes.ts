// Authentication routes: login, refresh token, and logout
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { sign, verify } from "hono/jwt";
import { PrismaClientKnownRequestError } from "../../../generated/prisma/runtime/client";
import type { Role } from "../../../generated/prisma";
import { env } from "../../config/env";
import {
  authMiddleware,
  blacklistToken,
  getAuthPayload,
  type AuthVariables,
} from "../../middlewares/auth";
import { ACCESS_TOKEN_TTL_SECONDS } from "../../config/constants";
import { emailTransport, type EmailTransport } from "../../utils/email";
import { AuthService } from "./auth-service";
import {
  loginSchema,
  authResponseSchema,
  refreshTokenSchema,
  logoutResponseSchema,
  registerSchema,
  registerResponseSchema,
  meResponseSchema,
  forgotPasswordSchema,
  forgotPasswordResponseSchema,
} from "./auth-schema";
import {
  errorResponseSchema,
  validationErrorResponseSchema,
} from "../../schemas/response";
import { successResponse, errorResponse } from "../../utils/response";

// Frontend route that handles the reset-password flow (see Task 2.6).
function buildResetUrl(token: string): string {
  const base = env.APP_URL.replace(/\/$/, "");
  return `${base}/reset-password?token=${token}`;
}

function buildResetEmailHtml(resetUrl: string): string {
  return [
    "<p>Recebemos um pedido para redefinir a senha da sua conta no Velon.</p>",
    `<p><a href="${resetUrl}">Clique aqui para redefinir sua senha</a></p>`,
    "<p>Este link expira em 1 hora. Se você não fez este pedido, ignore este e-mail.</p>",
  ].join("");
}

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
  registerUser(data: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ id: number; email: string }>;
  findById(
    id: number,
  ): Promise<{ id: number; email: string; name: string | null } | null>;
}

// === Factory function ===
// Receives a userRepo and an optional authService (defaults to a new AuthService).
// Wiring with concrete implementations happens at the composition root (index.ts).
export function createAuthRoutes(
  userRepo: IUserAuthRepository,
  authService: AuthService = new AuthService(),
  email: EmailTransport = emailTransport,
) {
  const authRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

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

  const meRoute = createRoute({
    method: "get",
    path: "/me",
    tags: ["Auth"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        content: { "application/json": { schema: meResponseSchema } },
        description: "Authenticated user info with company status",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "User not found",
      },
    },
  });

  const registerRoute = createRoute({
    method: "post",
    path: "/register",
    tags: ["Auth"],
    request: {
      body: {
        content: { "application/json": { schema: registerSchema } },
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: registerResponseSchema } },
        description: "User registered and logged in",
      },
      400: {
        content: {
          "application/json": { schema: validationErrorResponseSchema },
        },
        description: "Validation error",
      },
      409: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Email already registered",
      },
    },
  });

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

  const forgotPasswordRoute = createRoute({
    method: "post",
    path: "/forgot-password",
    tags: ["Auth"],
    request: {
      body: {
        content: { "application/json": { schema: forgotPasswordSchema } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: forgotPasswordResponseSchema },
        },
        description:
          "Request acknowledged. A reset link is sent only if the email matches an account",
      },
      400: {
        content: {
          "application/json": { schema: validationErrorResponseSchema },
        },
        description: "Validation error",
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

  // /me is the only auth route that requires a valid token
  authRoutes.use("/me", authMiddleware);

  // === Me Handler ===
  authRoutes.openapi(meRoute, async (c) => {
    const payload = getAuthPayload(c);
    const user = await userRepo.findById(payload.id);
    if (!user) {
      return errorResponse(c, "User not found", 404);
    }
    return successResponse(
      c,
      {
        id: user.id,
        email: user.email,
        name: user.name,
        hasCompany: payload.companyId !== null,
      },
      200,
    );
  });

  // === Register Handler ===
  authRoutes.openapi(registerRoute, async (c) => {
    const { name, email, password } = c.req.valid("json");

    let user: { id: number; email: string };
    try {
      user = await userRepo.registerUser({ name, email, password });
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return errorResponse(c, "Este e-mail já está cadastrado", 409);
      }
      throw err;
    }

    const refreshToken = await authService.generateRefreshToken(user.id);
    const accessToken = await generateAccessToken(user, null);

    return successResponse(
      c,
      { token: accessToken, refreshToken },
      201,
      "Conta criada com sucesso",
    );
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

  // === Forgot Password Handler ===
  authRoutes.openapi(forgotPasswordRoute, async (c) => {
    const { email: rawEmail } = c.req.valid("json");

    // Always respond the same way, regardless of whether the account exists,
    // so the endpoint can't be used to probe which emails are registered.
    const user = await userRepo.findByEmail(rawEmail);
    if (user) {
      const token = await authService.createPasswordResetToken(user.id);
      await email.send({
        to: user.email,
        subject: "Redefinição de senha — Velon",
        html: buildResetEmailHtml(buildResetUrl(token)),
      });
    }

    return successResponse(
      c,
      {
        message:
          "Se houver uma conta com este e-mail, enviaremos as instruções para redefinir a senha.",
      },
      200,
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
