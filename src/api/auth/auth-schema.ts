// Zod schemas for auth validation and OpenAPI documentation
import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";

export const loginSchema = z
  .object({
    email: z.email().openapi({
      example: "admin@template.com",
      description: "User's registered email address",
    }),
    password: z.string().min(1).openapi({
      description: "User password",
      example: "secret123",
    }),
  })
  .openapi("LoginInput");

export const loginResponseSchema = z
  .object({
    token: z.string().openapi({ description: "JWT access token" }),
    refreshToken: z.string().openapi({ description: "Refresh token" }),
  })
  .openapi("LoginResponse");

// Login/refresh success response schema
export const authResponseSchema = successResponseSchema(
  loginResponseSchema,
  "AuthResponse",
);

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1).openapi({
      description: "Refresh token for obtaining new access tokens",
    }),
  })
  .openapi("RefreshTokenInput");

// Schema for logout/simple message responses
export const messageSchema = z
  .object({
    message: z.string().openapi({ description: "Response message" }),
  })
  .openapi("MessageResponse");

export const logoutResponseSchema = successResponseSchema(
  messageSchema,
  "LogoutResponse",
);
