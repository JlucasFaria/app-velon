import crypto from "crypto";
import { HTTPException } from "hono/http-exception";
import prismaClient from "../../db/client";
import type { PrismaClient, Role } from "../../../generated/prisma";
import { INVITE_TOKEN_TTL_MS } from "../../config/constants";
import { env } from "../../config/env";
import { emailTransport, type EmailTransport } from "../../utils/email";

const INVITE_SELECT = {
  id: true,
  invitedEmail: true,
  role: true,
  status: true,
  inviteExpiresAt: true,
} as const;

// Frontend route that handles the accept-invite flow (see Group 3 Task 9).
function buildInviteUrl(token: string): string {
  const base = env.APP_URL.replace(/\/$/, "");
  return `${base}/invites/${token}`;
}

function buildInviteEmailHtml(inviteUrl: string): string {
  return [
    "<p>Você foi convidado para participar de uma empresa no Velon.</p>",
    `<p><a href="${inviteUrl}">Clique aqui para aceitar o convite</a></p>`,
    "<p>Este link expira em 7 dias.</p>",
  ].join("");
}

export class MemberService {
  constructor(
    private prisma: PrismaClient = prismaClient,
    private email: EmailTransport = emailTransport,
  ) {}

  // Creates a PENDING invite (a Membership with no user yet) for an email and
  // sends the accept link via the configured transport. Returns the invite
  // metadata plus the link so the caller can optionally surface it (dev).
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

    const invite = await this.prisma.membership.create({
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

    const inviteUrl = buildInviteUrl(inviteToken);
    await this.email.send({
      to: invitedEmail,
      subject: "Você foi convidado para o Velon",
      html: buildInviteEmailHtml(inviteUrl),
    });

    return { ...invite, inviteUrl };
  }
}
