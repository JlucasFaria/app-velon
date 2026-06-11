// Shared helpers for multi-tenant tests: spin up an isolated company + user +
// active membership and sign an access token scoped to that company.
import prisma from "../db/client";
import { sign } from "hono/jwt";
import { env } from "../config/env";
import type { Role } from "../../generated/prisma";

export async function signTestToken(
  id: number,
  email: string,
  companyId: number | null,
  role: Role | null,
): Promise<string> {
  return sign(
    {
      id,
      email,
      companyId,
      role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    },
    env.JWT_SECRET,
  );
}

// Creates an isolated company and returns its id.
export async function createTestCompany(
  name = "Test Company",
): Promise<number> {
  const company = await prisma.company.create({ data: { name } });
  return company.id;
}

export interface TestAuthContext {
  token: string;
  companyId: number;
  userId: number;
  email: string;
}

// Creates a company + user + active membership and a matching access token.
export async function createTestAuthContext(opts?: {
  email?: string;
  role?: Role;
  companyName?: string;
}): Promise<TestAuthContext> {
  const company = await prisma.company.create({
    data: { name: opts?.companyName ?? "Test Company" },
  });
  const email = opts?.email ?? `user-${crypto.randomUUID()}@test.com`;
  const role: Role = opts?.role ?? "ADMIN";

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password: "hashed", name: "Tester" },
  });

  await prisma.membership.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: { role, status: "ACTIVE" },
    create: { userId: user.id, companyId: company.id, role, status: "ACTIVE" },
  });

  const token = await signTestToken(user.id, email, company.id, role);
  return { token, companyId: company.id, userId: user.id, email };
}
