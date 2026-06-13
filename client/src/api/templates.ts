import { apiRequest } from "./client";

export interface TemplateItem {
  id: number;
  description: string;
  category: string | null;
  suggestedValue: string;
  quantity: number | null;
}

export interface ServiceTemplate {
  id: number;
  name: string;
  defaultDescription: string;
  items: TemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateItemInput {
  description: string;
  category?: string;
  suggestedValue: string;
  quantity?: number;
}

export interface TemplateInput {
  name: string;
  defaultDescription: string;
  items: TemplateItemInput[];
}

export function getTemplates() {
  return apiRequest<ServiceTemplate[]>("/templates");
}

export function getTemplate(id: number) {
  return apiRequest<ServiceTemplate>(`/templates/${id}`);
}

export function createTemplate(input: TemplateInput) {
  return apiRequest<ServiceTemplate>("/templates", {
    method: "POST",
    body: input,
  });
}

export function updateTemplate(id: number, input: Partial<TemplateInput>) {
  return apiRequest<ServiceTemplate>(`/templates/${id}`, {
    method: "PUT",
    body: input,
  });
}

export function deleteTemplate(id: number) {
  return apiRequest<{ message?: string }>(`/templates/${id}`, {
    method: "DELETE",
  });
}
