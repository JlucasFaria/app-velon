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

export const registerSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").openapi({
      example: "João Silva",
      description: "Full name of the user",
    }),
    email: z.string().email("E-mail inválido").openapi({
      example: "joao@example.com",
      description: "Unique email address",
    }),
    password: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres")
      .regex(/[a-zA-Z]/, "A senha deve conter ao menos uma letra")
      .regex(/[0-9]/, "A senha deve conter ao menos um número")
      .openapi({
        description: "Password — at least 8 chars, 1 letter and 1 number",
        example: "senha123",
      }),
    passwordConfirmation: z
      .string()
      .min(1, "Confirmação de senha é obrigatória")
      .openapi({ description: "Must match password", example: "senha123" }),
  })
  .refine((d) => d.password === d.passwordConfirmation, {
    message: "As senhas não coincidem",
    path: ["passwordConfirmation"],
  })
  .openapi("RegisterInput");

export const registerResponseSchema = successResponseSchema(
  loginResponseSchema,
  "RegisterResponse",
);

export const forgotPasswordSchema = z
  .object({
    email: z.email().openapi({
      example: "admin@template.com",
      description: "Email address to send the password reset link to",
    }),
  })
  .openapi("ForgotPasswordInput");

// Generic acknowledgement — intentionally the same whether or not the email
// matches a user, so the response can't be used to enumerate accounts.
export const forgotPasswordResponseSchema = successResponseSchema(
  messageSchema,
  "ForgotPasswordResponse",
);

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token é obrigatório").openapi({
      description: "Single-use password reset token from the email link",
    }),
    password: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres")
      .regex(/[a-zA-Z]/, "A senha deve conter ao menos uma letra")
      .regex(/[0-9]/, "A senha deve conter ao menos um número")
      .openapi({
        description: "New password — at least 8 chars, 1 letter and 1 number",
        example: "novasenha123",
      }),
  })
  .openapi("ResetPasswordInput");

export const resetPasswordResponseSchema = successResponseSchema(
  messageSchema,
  "ResetPasswordResponse",
);

export const meResponseSchema = successResponseSchema(
  z
    .object({
      id: z.number().openapi({ example: 1 }),
      email: z.string().openapi({ example: "joao@example.com" }),
      name: z.string().nullable().openapi({ example: "João Silva" }),
      hasCompany: z.boolean().openapi({
        description: "True when the user has completed onboarding",
        example: false,
      }),
    })
    .openapi("MeData"),
  "MeResponse",
);
