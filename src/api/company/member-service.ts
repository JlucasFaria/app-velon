import crypto from "crypto";
import { HTTPException } from "hono/http-exception";
import prismaClient from "../../db/client";
import type { PrismaClient, Role } from "../../../generated/prisma";
import { INVITE_TOKEN_TTL_MS } from "../../config/constants";

const INVITE_SELECT = {
  id: true,
  invitedEmail: true,
  role: true,
  status: true,
  inviteExpiresAt: true,
} as const;

export class MemberService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  // Creates a PENDING invite (a Membership with no user yet) for an email.
  // The raw token is stored on the row; Task 3 builds the accept link from it.
  async inviteMember(companyId: number, email: string, role: Role) {
    const invitedEmail = email.trim().toLowerCase();

    // Already an active member of this company?
    const activeMember = await this.prisma.membership.findFirst({
      where: { companyId, status: "ACTIVE", user: { email: invitedEmail } },
      select: { id: true },
    });
    if (activeMember) {
      throw new HTTPException(409, {
        message: "Usuário já é membro da empresa",
      });
    }

    // Already has a pending invite for this company?
    const pendingInvite = await this.prisma.membership.findFirst({
      where: { companyId, status: "PENDING", invitedEmail },
      select: { id: true },
    });
    if (pendingInvite) {
      throw new HTTPException(409, {
        message: "Convite já enviado para este e-mail",
      });
    }

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

    return await this.prisma.membership.create({
      data: {
        companyId,
        invitedEmail,
        inviteToken,
        inviteExpiresAt,
        role,
        status: "PENDING",
      },
      select: INVITE_SELECT,
    });
  }
}
