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

const MEMBER_SELECT = {
  id: true,
  role: true,
  status: true,
  invitedEmail: true,
  inviteExpiresAt: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
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

  async listMembers(companyId: number) {
    const rows = await this.prisma.membership.findMany({
      where: { companyId },
      orderBy: [{ status: "asc" }, { id: "asc" }],
      select: MEMBER_SELECT,
    });
    return rows.map((m) => ({ ...m, joinedAt: m.createdAt.toISOString() }));
  }

  // Regenerates the invite token and resends the email. Only valid for PENDING.
  async resendInvite(membershipId: number, companyId: number) {
    const invite = await this.prisma.membership.findFirst({
      where: { id: membershipId, companyId, status: "PENDING" },
      select: { id: true, invitedEmail: true },
    });
    if (!invite) {
      throw new HTTPException(404, {
        message: "Convite pendente não encontrado",
      });
    }

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { inviteToken, inviteExpiresAt },
      select: INVITE_SELECT,
    });

    const inviteUrl = buildInviteUrl(inviteToken);
    await this.email.send({
      to: invite.invitedEmail!,
      subject: "Você foi convidado para o Velon",
      html: buildInviteEmailHtml(inviteUrl),
    });

    return { ...updated, inviteUrl };
  }

  // Changes the role of an ACTIVE member. Prevents removing the last admin.
  async changeRole(
    membershipId: number,
    companyId: number,
    callerId: number,
    newRole: Role,
  ) {
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, companyId, status: "ACTIVE" },
      select: MEMBER_SELECT,
    });
    if (!target) {
      throw new HTTPException(404, { message: "Membro ativo não encontrado" });
    }

    if (target.role === "ADMIN" && newRole !== "ADMIN") {
      const adminCount = await this.prisma.membership.count({
        where: { companyId, role: "ADMIN", status: "ACTIVE" },
      });
      if (adminCount <= 1) {
        throw new HTTPException(409, {
          message: "Não é possível rebaixar o único administrador da empresa",
        });
      }
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { role: newRole },
      select: MEMBER_SELECT,
    });
    return { ...updated, joinedAt: updated.createdAt.toISOString() };
  }

  // Sets an ACTIVE membership to REVOKED. Cannot revoke self or the last admin.
  async revokeMember(
    membershipId: number,
    companyId: number,
    callerId: number,
  ) {
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, companyId, status: "ACTIVE" },
      select: { ...MEMBER_SELECT, userId: true },
    });
    if (!target) {
      throw new HTTPException(404, { message: "Membro ativo não encontrado" });
    }
    if (target.userId === callerId) {
      throw new HTTPException(409, {
        message: "Não é possível revogar seu próprio acesso",
      });
    }
    if (target.role === "ADMIN") {
      const adminCount = await this.prisma.membership.count({
        where: { companyId, role: "ADMIN", status: "ACTIVE" },
      });
      if (adminCount <= 1) {
        throw new HTTPException(409, {
          message: "Não é possível revogar o único administrador da empresa",
        });
      }
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { status: "REVOKED" },
      select: MEMBER_SELECT,
    });
    return { ...updated, joinedAt: updated.createdAt.toISOString() };
  }

  // Permanently deletes a membership row. Cannot remove self or the last admin.
  async removeMember(
    membershipId: number,
    companyId: number,
    callerId: number,
  ) {
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, companyId },
      select: { userId: true, role: true, status: true },
    });
    if (!target) {
      throw new HTTPException(404, { message: "Membro não encontrado" });
    }
    if (target.userId === callerId) {
      throw new HTTPException(409, {
        message: "Não é possível remover seu próprio acesso",
      });
    }
    if (target.role === "ADMIN" && target.status === "ACTIVE") {
      const adminCount = await this.prisma.membership.count({
        where: { companyId, role: "ADMIN", status: "ACTIVE" },
      });
      if (adminCount <= 1) {
        throw new HTTPException(409, {
          message: "Não é possível remover o único administrador da empresa",
        });
      }
    }

    await this.prisma.membership.delete({ where: { id: membershipId } });
  }
}
