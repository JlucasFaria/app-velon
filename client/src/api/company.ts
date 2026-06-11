import { apiRequest, apiUpload } from "./client";

export type MemberRole = "ADMIN" | "OPERATOR" | "VIEWER";
export type MemberStatus = "PENDING" | "ACTIVE" | "REVOKED";

export interface Member {
  id: number;
  role: MemberRole;
  status: MemberStatus;
  invitedEmail: string | null;
  inviteExpiresAt: string | null;
  joinedAt: string;
  user: { id: number; name: string | null; email: string } | null;
}

export interface Company {
  id: number;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logoUrl: string | null;
  footerNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyInput {
  name?: string;
  // null clears the field; undefined leaves it unchanged.
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  footerNote?: string | null;
}

export interface SetupCompanyInput {
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export function setupCompany(input: SetupCompanyInput) {
  return apiRequest<Company>("/company/setup", { method: "POST", body: input });
}

export function getCompany() {
  return apiRequest<Company>("/company");
}

export function updateCompany(input: CompanyInput) {
  return apiRequest<Company>("/company", { method: "PATCH", body: input });
}

export function uploadCompanyLogo(file: File) {
  const form = new FormData();
  form.append("logo", file);
  return apiUpload<Company>("/company/logo", form);
}

export function listMembers() {
  return apiRequest<Member[]>("/company/members");
}

export interface InviteMemberInput {
  email: string;
  role: MemberRole;
}

export function inviteMember(input: InviteMemberInput) {
  return apiRequest<Member>("/company/members/invite", {
    method: "POST",
    body: input,
  });
}

export function resendInvite(memberId: number) {
  return apiRequest<Member>(`/company/members/${memberId}/resend`, {
    method: "POST",
  });
}

export function changeMemberRole(memberId: number, role: MemberRole) {
  return apiRequest<Member>(`/company/members/${memberId}/role`, {
    method: "PATCH",
    body: { role },
  });
}

export function revokeMember(memberId: number) {
  return apiRequest<Member>(`/company/members/${memberId}/revoke`, {
    method: "PATCH",
  });
}

export function removeMember(memberId: number) {
  return apiRequest<{ message: string }>(`/company/members/${memberId}`, {
    method: "DELETE",
  });
}
