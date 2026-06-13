// Signed tokens for public, time-limited OS PDF sharing. The token is an HMAC
// JWT (same secret as auth) carrying the order/company it grants access to and a
// 7-day expiry, so the link works without a session — but only for that order,
// only until it expires. The `kind` claim isolates it from access tokens: an
// access JWT can never be replayed as a share link, and vice versa.

import { sign, verify } from "hono/jwt";
import { env } from "../config/env";
import { PDF_SHARE_TOKEN_TTL_SECONDS } from "../config/constants";

const SHARE_TOKEN_KIND = "pdf-share";

export type PdfShareVerifyResult =
  | { status: "valid"; orderId: number; companyId: number }
  | { status: "expired" }
  | { status: "invalid" };

export async function signPdfShareToken(
  orderId: number,
  companyId: number,
): Promise<{ token: string; expiresAt: Date }> {
  const expSeconds =
    Math.floor(Date.now() / 1000) + PDF_SHARE_TOKEN_TTL_SECONDS;
  const token = await sign(
    { kind: SHARE_TOKEN_KIND, orderId, companyId, exp: expSeconds },
    env.JWT_SECRET,
  );
  return { token, expiresAt: new Date(expSeconds * 1000) };
}

export async function verifyPdfShareToken(
  token: string,
): Promise<PdfShareVerifyResult> {
  let payload: unknown;
  try {
    payload = await verify(token, env.JWT_SECRET);
  } catch (e) {
    if (e instanceof Error && e.name === "JwtTokenExpired") {
      return { status: "expired" };
    }
    return { status: "invalid" };
  }

  const claims = payload as {
    kind?: unknown;
    orderId?: unknown;
    companyId?: unknown;
  };
  if (
    claims.kind !== SHARE_TOKEN_KIND ||
    typeof claims.orderId !== "number" ||
    typeof claims.companyId !== "number"
  ) {
    return { status: "invalid" };
  }

  return {
    status: "valid",
    orderId: claims.orderId,
    companyId: claims.companyId,
  };
}
