import { apiRequest } from "./client";
import type { TokenPair } from "./auth";
import type { MemberRole } from "./company";

export interface InviteInfo {
  invitedEmail: string;
  role: MemberRole;
  companyName: string;
  inviteExpiresAt: string;
  userExists: boolean;
}

export function getInviteInfo(token: string) {
  return apiRequest<InviteInfo>(`/invites/${token}`);
}

export interface AcceptInviteInput {
  name?: string;
  password: string;
}

export function acceptInvite(token: string, input: AcceptInviteInput) {
  return apiRequest<TokenPair>(`/invites/${token}/accept`, {
    method: "POST",
    body: input,
  });
}
