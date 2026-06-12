import { HTTPException } from "hono/http-exception";
import prismaClient from "../../db/client";
import type { PrismaClient } from "../../../generated/prisma";

export class InviteService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async validateInvite(token: string) {
    const invite = await this.prisma.membership.findUnique({
      where: { inviteToken: token },
      select: {
        status: true,
        invitedEmail: true,
        role: true,
        inviteExpiresAt: true,
        company: { select: { name: true } },
      },
    });

    if (!invite || invite.status !== "PENDING") {
      throw new HTTPException(404, {
        message: "Convite não encontrado ou já utilizado",
      });
    }
    if (invite.inviteExpiresAt && invite.inviteExpiresAt < new Date()) {
      throw new HTTPException(410, { message: "Este convite expirou" });
    }

    const userExists =
      (await this.prisma.user.findUnique({
        where: { email: invite.invitedEmail! },
        select: { id: true },
      })) !== null;

    return {
      invitedEmail: invite.invitedEmail!,
      role: invite.role,
      companyName: invite.company.name,
      inviteExpiresAt: invite.inviteExpiresAt!.toISOString(),
      userExists,
    };
  }

  // Accepts an invite and returns user + membership for token generation.
  // Handles two paths:
  //  - Existing user: verifies password, links membership
  //  - New user: creates account (requires name), links membership
  async acceptInvite(token: string, data: { name?: string; password: string }) {
    return await this.prisma.$transaction(async (tx) => {
      // Re-validate inside the transaction to prevent double-accept races
      const invite = await tx.membership.findUnique({
        where: { inviteToken: token },
        select: {
          id: true,
          companyId: true,
          invitedEmail: true,
          role: true,
          status: true,
          inviteExpiresAt: true,
        },
      });

      if (!invite || invite.status !== "PENDING") {
        throw new HTTPException(404, {
          message: "Convite não encontrado ou já utilizado",
        });
      }
      if (invite.inviteExpiresAt && invite.inviteExpiresAt < new Date()) {
        throw new HTTPException(410, { message: "Este convite expirou" });
      }

      const invitedEmail = invite.invitedEmail!;
      let userId: number;
      let userEmail: string;

      const existingUser = await tx.user.findUnique({
        where: { email: invitedEmail },
        select: { id: true, email: true, password: true },
      });

      if (existingUser) {
        const valid = await Bun.password.verify(
          data.password,
          existingUser.password,
        );
        if (!valid) {
          throw new HTTPException(401, { message: "Senha incorreta" });
        }
        userId = existingUser.id;
        userEmail = existingUser.email;

        // A previous REVOKED membership for this user+company would violate
        // @@unique([userId, companyId]). Remove it before re-activating.
        await tx.membership.deleteMany({
          where: { userId, companyId: invite.companyId, status: "REVOKED" },
        });
      } else {
        if (!data.name?.trim()) {
          throw new HTTPException(400, {
            message: "Nome é obrigatório para novos usuários",
          });
        }
        const hashed = await Bun.password.hash(data.password);
        const newUser = await tx.user.create({
          data: {
            email: invitedEmail,
            name: data.name.trim(),
            password: hashed,
          },
          select: { id: true, email: true },
        });
        userId = newUser.id;
        userEmail = newUser.email;
      }

      // Activate the membership row — clear invite fields so the token is
      // single-use and the slot is freed for a potential future re-invite.
      await tx.membership.update({
        where: { id: invite.id },
        data: {
          userId,
          status: "ACTIVE",
          inviteToken: null,
          inviteExpiresAt: null,
        },
      });

      return {
        user: { id: userId, email: userEmail },
        membership: { companyId: invite.companyId, role: invite.role },
      };
    });
  }
}
