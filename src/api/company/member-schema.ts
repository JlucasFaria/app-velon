import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";

// Roles assignable to an invited member (mirrors the Prisma Role enum).
export const roleSchema = z.enum(["ADMIN", "OPERATOR", "VIEWER"]);

export const inviteMemberSchema = z
  .object({
    email: z.email("E-mail inválido").openapi({
      example: "colega@empresa.com",
      description: "Email address of the person to invite",
    }),
    role: roleSchema.openapi({
      example: "OPERATOR",
      description: "Access level granted to the invited member",
    }),
  })
  .openapi("InviteMemberInput");

export const memberInviteResponseSchema = successResponseSchema(
  z
    .object({
      id: z.number().openapi({ example: 12 }),
      // Nullable in the DB (only invites carry it); always set for an invite.
      invitedEmail: z
        .string()
        .nullable()
        .openapi({ example: "colega@empresa.com" }),
      role: roleSchema.openapi({ example: "OPERATOR" }),
      status: z
        .enum(["ACTIVE", "PENDING", "REVOKED"])
        .openapi({ example: "PENDING" }),
      inviteExpiresAt: z.string().datetime().nullable().openapi({
        description: "When the invite link expires (ISO 8601)",
      }),
      // Returned only outside production so the UI can offer a "copy link"
      // fallback; in production the link is delivered by email only.
      inviteUrl: z.string().optional().openapi({
        description: "Accept-invite link (non-production only)",
        example: "http://localhost:5173/invites/abc123",
      }),
    })
    .openapi("MemberInvite"),
  "MemberInviteResponse",
);

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
