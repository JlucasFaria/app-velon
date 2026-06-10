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
  document?: string;
  phone?: string;
  email?: string;
  address?: string;
  footerNote?: string;
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
