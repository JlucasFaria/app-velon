import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getCompanyContext, type AuthVariables } from "../../middlewares/auth";
import { requireMinRole } from "../../middlewares/permissions";
import { env } from "../../config/env";
import { successResponse } from "../../utils/response";
import {
  errorResponseSchema,
  validationErrorResponseSchema,
} from "../../schemas/response";
import { MemberService } from "./member-service";
import {
  inviteMemberSchema,
  memberInviteResponseSchema,
  memberListResponseSchema,
  memberDetailResponseSchema,
  changeRoleSchema,
  memberIdParamSchema,
} from "./member-schema";

// Member management routes. Mounted under the company router at
// `/api/company/members`, so the parent's authMiddleware already protects
// these — no need to re-apply it here.
export function createMemberRoutes(
  memberService: MemberService = new MemberService(),
) {
  const memberRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

  // All member management actions are admin-only.
  // Inherits authMiddleware from the parent company router.
  memberRoutes.use("/*", requireMinRole("ADMIN"));

  // ─── Route Definitions ──────────────────────────────────────────

  const listMembersRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Members"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        content: { "application/json": { schema: memberListResponseSchema } },
        description: "Member list",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      403: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Caller has no company or is not an admin",
      },
    },
  });

  const inviteRoute = createRoute({
    method: "post",
    path: "/invite",
    tags: ["Members"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: inviteMemberSchema } },
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: memberInviteResponseSchema } },
        description: "Invite created",
      },
      400: {
        content: {
          "application/json": { schema: validationErrorResponseSchema },
        },
        description: "Validation error",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      403: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Caller has no company or is not an admin",
      },
      409: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Email is already a member or already invited",
      },
    },
  });

  const resendInviteRoute = createRoute({
    method: "post",
    path: "/:id/resend",
    tags: ["Members"],
    security: [{ bearerAuth: [] }],
    request: { params: memberIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: memberInviteResponseSchema } },
        description: "Invite resent with a fresh token",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      403: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Caller has no company or is not an admin",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Pending invite not found",
      },
    },
  });

  const changeRoleRoute = createRoute({
    method: "patch",
    path: "/:id/role",
    tags: ["Members"],
    security: [{ bearerAuth: [] }],
    request: {
      params: memberIdParamSchema,
      body: {
        content: { "application/json": { schema: changeRoleSchema } },
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: memberDetailResponseSchema } },
        description: "Member role updated",
      },
      400: {
        content: {
          "application/json": { schema: validationErrorResponseSchema },
        },
        description: "Validation error",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      403: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Caller has no company or is not an admin",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Active member not found",
      },
      409: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Cannot demote the last admin",
      },
    },
  });

  const revokeRoute = createRoute({
    method: "patch",
    path: "/:id/revoke",
    tags: ["Members"],
    security: [{ bearerAuth: [] }],
    request: { params: memberIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: memberDetailResponseSchema } },
        description: "Member access revoked",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      403: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Caller has no company or is not an admin",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Active member not found",
      },
      409: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Cannot revoke self or the last admin",
      },
    },
  });

  const removeMemberRoute = createRoute({
    method: "delete",
    path: "/:id",
    tags: ["Members"],
    security: [{ bearerAuth: [] }],
    request: { params: memberIdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z
              .object({ success: z.literal(true), message: z.string() })
              .openapi("RemoveMemberResponse"),
          },
        },
        description: "Member removed",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Missing or invalid authentication token",
      },
      403: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Caller has no company or is not an admin",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Member not found",
      },
      409: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Cannot remove self or the last admin",
      },
    },
  });

  // ─── Route Handlers ─────────────────────────────────────────────

  memberRoutes.openapi(listMembersRoute, async (c) => {
    const { companyId } = getCompanyContext(c);
    const members = await memberService.listMembers(companyId);
    return successResponse(c, members, 200);
  });

  memberRoutes.openapi(inviteRoute, async (c) => {
    const { companyId } = getCompanyContext(c);
    const { email, role: invitedRole } = c.req.valid("json");
    const invite = await memberService.inviteMember(
      companyId,
      email,
      invitedRole,
    );

    // The link is emailed in all environments; echo it in the response only
    // outside production so the UI can offer a "copy link" fallback.
    const data =
      env.NODE_ENV === "production"
        ? { ...invite, inviteUrl: undefined }
        : invite;

    return successResponse(c, data, 201, "Convite criado com sucesso");
  });

  memberRoutes.openapi(resendInviteRoute, async (c) => {
    const { companyId } = getCompanyContext(c);
    const { id } = c.req.valid("param");
    const invite = await memberService.resendInvite(id, companyId);
    const data =
      env.NODE_ENV === "production"
        ? { ...invite, inviteUrl: undefined }
        : invite;
    return successResponse(c, data, 200, "Convite reenviado com sucesso");
  });

  memberRoutes.openapi(changeRoleRoute, async (c) => {
    const { companyId, userId: callerId } = getCompanyContext(c);
    const { id } = c.req.valid("param");
    const { role } = c.req.valid("json");
    const member = await memberService.changeRole(
      id,
      companyId,
      callerId,
      role,
    );
    return successResponse(c, member, 200, "Papel atualizado com sucesso");
  });

  memberRoutes.openapi(revokeRoute, async (c) => {
    const { companyId, userId: callerId } = getCompanyContext(c);
    const { id } = c.req.valid("param");
    const member = await memberService.revokeMember(id, companyId, callerId);
    return successResponse(c, member, 200, "Acesso revogado com sucesso");
  });

  memberRoutes.openapi(removeMemberRoute, async (c) => {
    const { companyId, userId: callerId } = getCompanyContext(c);
    const { id } = c.req.valid("param");
    await memberService.removeMember(id, companyId, callerId);
    return c.json(
      { success: true as const, message: "Membro removido com sucesso" },
      200,
    );
  });

  return memberRoutes;
}
