import { apiRequest, buildQuery, type Pagination } from "./client";
import type { ClientType } from "./clients";

export type OrderStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "AWAITING_CLIENT"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentStatus =
  | "UNPAID"
  | "PAID_PIX"
  | "PAID_CREDIT"
  | "PAID_DEBIT"
  | "PAID_CASH"
  | "PAID_TRANSFER"
  | "PAID_OTHER";

// Human labels shared by the form, list badge, and detail view.
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Não pago",
  PAID_PIX: "Pix",
  PAID_CREDIT: "Cartão de crédito",
  PAID_DEBIT: "Cartão de débito",
  PAID_CASH: "Dinheiro",
  PAID_TRANSFER: "Transferência",
  PAID_OTHER: "Outro",
};

// A payment counts as settled for any non-UNPAID status.
export function isPaid(status: PaymentStatus): boolean {
  return status !== "UNPAID";
}

export interface OrderItem {
  id: number;
  description: string;
  category: string | null;
  unitValue: string;
  quantity: number;
  subtotal: string;
}

export interface OrderItemInput {
  description: string;
  category?: string;
  unitValue: string;
  quantity: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  description: string;
  value: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentNote: string | null;
  assignedUserId: number | null;
  clientId: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface StatusHistoryEntry {
  id: number;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedAt: string;
  note: string | null;
  changedBy: {
    id: number;
    name: string | null;
    email: string;
  };
}

export interface OrderDetail extends Order {
  client: {
    id: number;
    name: string;
    document: string;
    clientType: ClientType;
  };
  statusHistory: StatusHistoryEntry[];
}

export interface OrderInput {
  description: string;
  items: OrderItemInput[];
  clientId: number;
  assignedUserId?: number;
  paymentStatus?: PaymentStatus;
  paymentNote?: string;
}

export interface UpdateOrderInput {
  description?: string;
  items?: OrderItemInput[];
  assignedUserId?: number | null;
  paymentStatus?: PaymentStatus;
  paymentNote?: string | null;
}

// List rows embed the client's id + name (see backend ORDER_LIST_SELECT) so the
// orders table can show the client without an extra fetch per row.
export interface OrderListItem extends Order {
  client: {
    id: number;
    name: string;
  };
}

export interface PaginatedOrders {
  orders: OrderListItem[];
  pagination: Pagination;
}

export interface ListOrdersParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  clientType?: ClientType;
  search?: string;
}

export function getOrders(params: ListOrdersParams = {}) {
  return apiRequest<PaginatedOrders>(`/orders${buildQuery({ ...params })}`);
}

export function getOrder(id: number) {
  return apiRequest<OrderDetail>(`/orders/${id}`);
}

export function createOrder(input: OrderInput) {
  return apiRequest<Order>("/orders", { method: "POST", body: input });
}

export function updateOrder(id: number, input: UpdateOrderInput) {
  return apiRequest<Order>(`/orders/${id}`, { method: "PUT", body: input });
}

export function changeOrderStatus(
  id: number,
  status: OrderStatus,
  note?: string,
) {
  return apiRequest<OrderDetail>(`/orders/${id}/status`, {
    method: "PATCH",
    body: { status, note },
  });
}

export function deleteOrder(id: number) {
  return apiRequest<{ message?: string }>(`/orders/${id}`, {
    method: "DELETE",
  });
}
