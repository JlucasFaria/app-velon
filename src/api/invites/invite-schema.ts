import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";
import { roleSchema } from "../company/member-schema";
import { loginResponseSchema } from "../auth/auth-schema";

export const inviteParamSchema = z
  .object({ token: z.string().min(1).openapi({ example: "abc123" }) })
  .openapi("InviteParam");

export const inviteInfoSchema = z
  .object({
    invitedEmail: z.string().openapi({ example: "colega@empresa.com" }),
    role: roleSchema,
    companyName: z.string().openapi({ example: "Minha Empresa Ltda" }),
    inviteExpiresAt: z
      .string()
      .datetime()
      .openapi({ description: "Expiry date (ISO 8601)" }),
    // Tells the frontend whether to show "enter your password" (existing user)
    // or a full registration form (new user who needs to set a password + name).
    userExists: z.boolean().openapi({
      description: "True when the invited email already has an account",
    }),
  })
  .openapi("InviteInfo");

export const inviteInfoResponseSchema = successResponseSchema(
  inviteInfoSchema,
  "InviteInfoResponse",
);

export const acceptInviteSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").optional().openapi({
      description: "Full name — required only when creating a new account",
      example: "João Silva",
    }),
    password: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres")
      .regex(/[a-zA-Z]/, "A senha deve conter ao menos uma letra")
      .regex(/[0-9]/, "A senha deve conter ao menos um número")
      .openapi({
        description: "Password (min 8 chars, 1 letter, 1 number)",
        example: "senha123",
      }),
  })
  .openapi("AcceptInviteInput");

export const acceptInviteResponseSchema = successResponseSchema(
  loginResponseSchema,
  "AcceptInviteResponse",
);
