import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { sign } from "hono/jwt";
import type { Role } from "../../../generated/prisma";
import { env } from "../../config/env";
import { ACCESS_TOKEN_TTL_SECONDS } from "../../config/constants";
import { AuthService } from "../auth/auth-service";
import { InviteService } from "./invite-service";
import {
  inviteParamSchema,
  inviteInfoResponseSchema,
  acceptInviteSchema,
  acceptInviteResponseSchema,
} from "./invite-schema";
import {
  errorResponseSchema,
  validationErrorResponseSchema,
} from "../../schemas/response";
import { successResponse } from "../../utils/response";

export function createInviteRoutes(
  inviteService: InviteService = new InviteService(),
  authService: AuthService = new AuthService(),
) {
  const inviteRoutes = new OpenAPIHono();

  async function generateAccessToken(
    user: { id: number; email: string },
    membership: { companyId: number; role: Role },
  ) {
    return await sign(
      {
        id: user.id,
        email: user.email,
        companyId: membership.companyId,
        role: membership.role,
        exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
      },
      env.JWT_SECRET,
    );
  }

  const getInviteRoute = createRoute({
    method: "get",
    path: "/:token",
    tags: ["Invites"],
    request: { params: inviteParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: inviteInfoResponseSchema },
        },
        description: "Invite info (email, role, company, expiry)",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Invite not found or already used",
      },
      410: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Invite expired",
      },
    },
  });

  const acceptInviteRoute = createRoute({
    method: "post",
    path: "/:token/accept",
    tags: ["Invites"],
    request: {
      params: inviteParamSchema,
      body: {
        content: { "application/json": { schema: acceptInviteSchema } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: acceptInviteResponseSchema },
        },
        description: "Invite accepted — returns access and refresh tokens",
      },
      400: {
        content: {
          "application/json": { schema: validationErrorResponseSchema },
        },
        description: "Validation error or missing name for new user",
      },
      401: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Wrong password",
      },
      404: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Invite not found or already used",
      },
      410: {
        content: { "application/json": { schema: errorResponseSchema } },
        description: "Invite expired",
      },
    },
  });

  inviteRoutes.openapi(getInviteRoute, async (c) => {
    const { token } = c.req.valid("param");
    const info = await inviteService.validateInvite(token);
    return successResponse(c, info, 200);
  });

  inviteRoutes.openapi(acceptInviteRoute, async (c) => {
    const { token } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await inviteService.acceptInvite(token, body);
    const accessToken = await generateAccessToken(
      result.user,
      result.membership,
    );
    const refreshToken = await authService.generateRefreshToken(result.user.id);
    return successResponse(
      c,
      { token: accessToken, refreshToken },
      200,
      "Convite aceito com sucesso",
    );
  });

  return inviteRoutes;
}
