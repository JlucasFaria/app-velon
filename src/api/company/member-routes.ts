import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { getCompanyContext, type AuthVariables } from "../../middlewares/auth";
import { successResponse } from "../../utils/response";
import {
  errorResponseSchema,
  validationErrorResponseSchema,
} from "../../schemas/response";
import { MemberService } from "./member-service";
import {
  inviteMemberSchema,
  memberInviteResponseSchema,
} from "./member-schema";

// Member management routes. Mounted under the company router at
// `/api/company/members`, so the parent's authMiddleware already protects
// these — no need to re-apply it here.
export function createMemberRoutes(
  memberService: MemberService = new MemberService(),
) {
  const memberRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

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

  memberRoutes.openapi(inviteRoute, async (c) => {
    const { companyId, role } = getCompanyContext(c);
    // Admin-only. Task 5 will replace this inline check with a role middleware.
    if (role !== "ADMIN") {
      throw new HTTPException(403, {
        message: "Apenas administradores podem convidar membros",
      });
    }

    const { email, role: invitedRole } = c.req.valid("json");
    const invite = await memberService.inviteMember(
      companyId,
      email,
      invitedRole,
    );

    return successResponse(c, invite, 201, "Convite criado com sucesso");
  });

  return memberRoutes;
}
