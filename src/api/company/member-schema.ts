import { z } from "@hono/zod-openapi";
import { successResponseSchema } from "../../schemas/response";

// Roles assignable to an invited member (mirrors the Prisma Role enum).
export const roleSchema = z.enum(["ADMIN", "OPERATOR", "VIEWER"]);

export const memberIdParamSchema = z
  .object({
    id: z.coerce
      .number()
      .int()
      .positive()
      .openapi({
        param: { name: "id", in: "path" },
        description: "Membership ID",
        example: 1,
      }),
  })
  .openapi("MemberIdParam");

const memberUserSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    name: z.string().nullable().openapi({ example: "João Silva" }),
    email: z.string().openapi({ example: "joao@empresa.com" }),
  })
  .nullable()
  .openapi({ description: "Null for PENDING invites (no account yet)" });

export const memberListItemSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    role: roleSchema,
    status: z
      .enum(["ACTIVE", "PENDING", "REVOKED"])
      .openapi({ example: "ACTIVE" }),
    invitedEmail: z
      .string()
      .nullable()
      .openapi({ example: "colega@empresa.com" }),
    inviteExpiresAt: z.string().datetime().nullable(),
    user: memberUserSchema,
    joinedAt: z
      .string()
      .datetime()
      .openapi({ description: "Membership creation date" }),
  })
  .openapi("MemberListItem");

export const memberListResponseSchema = successResponseSchema(
  z.array(memberListItemSchema),
  "MemberListResponse",
);

export const memberDetailResponseSchema = successResponseSchema(
  memberListItemSchema,
  "MemberDetailResponse",
);

export const changeRoleSchema = z
  .object({ role: roleSchema })
  .openapi("ChangeRoleInput");

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
      // Accept-invite link, always returned so the admin can copy and share it
      // (the email transport delivers it as well).
      inviteUrl: z.string().optional().openapi({
        description: "Accept-invite link to share with the invited member",
        example: "http://localhost:5173/invites/abc123",
      }),
    })
    .openapi("MemberInvite"),
  "MemberInviteResponse",
);

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
