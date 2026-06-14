import { apiRequest, buildQuery } from "./client";
import type { Partner } from "./clients";

// The partner endpoints return the full row; autocomplete only needs id + name
// (the shared Partner shape), so the extra fields are kept here for completeness.
export interface PartnerFull extends Partner {
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

export function searchPartners(q?: string) {
  return apiRequest<PartnerFull[]>(`/company/partners${buildQuery({ q })}`);
}

export function createPartner(name: string) {
  return apiRequest<PartnerFull>("/company/partners", {
    method: "POST",
    body: { name },
  });
}
