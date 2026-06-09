import { apiRequest, buildQuery, type Pagination } from "./client";

export type ClientType = "COUNTER" | "PARTNER";

export interface Client {
  id: number;
  name: string;
  document: string;
  phone: string | null;
  address: string | null;
  clientType: ClientType;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedOrder {
  id: number;
  orderNumber: string;
  description: string;
  value: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDetail extends Client {
  orders: LinkedOrder[];
}

export interface ClientInput {
  name: string;
  document: string;
  phone?: string;
  address?: string;
  clientType: ClientType;
}

export interface PaginatedClients {
  clients: Client[];
  pagination: Pagination;
}

export interface ListClientsParams {
  page?: number;
  limit?: number;
  clientType?: ClientType;
  search?: string;
}

export function getClients(params: ListClientsParams = {}) {
  return apiRequest<PaginatedClients>(`/clients${buildQuery({ ...params })}`);
}

export function getClient(id: number) {
  return apiRequest<ClientDetail>(`/clients/${id}`);
}

export function createClient(input: ClientInput) {
  return apiRequest<Client>("/clients", { method: "POST", body: input });
}

export function updateClient(id: number, input: Partial<ClientInput>) {
  return apiRequest<Client>(`/clients/${id}`, { method: "PUT", body: input });
}

export function deleteClient(id: number) {
  return apiRequest<{ message?: string }>(`/clients/${id}`, {
    method: "DELETE",
  });
}
