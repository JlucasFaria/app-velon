import { apiRequest, apiUpload } from "./client";

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
