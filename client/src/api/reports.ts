import { apiRequest, buildQuery } from "./client";
import type { OrderStatus, PaymentStatus } from "./orders";

export interface OrdersSummary {
  PENDING: number;
  IN_PROGRESS: number;
  AWAITING_CLIENT: number;
  COMPLETED: number;
  CANCELLED: number;
}

export interface BillingOrder {
  id: number;
  orderNumber: string;
  description: string;
  value: string;
  completedAt: string;
  client: {
    id: number;
    name: string;
  };
}

export interface MonthlyBilling {
  month: number;
  year: number;
  totalRevenue: string;
  orderCount: number;
  orders: BillingOrder[];
}

export function getMonthlyBilling(month: number, year: number) {
  return apiRequest<MonthlyBilling>(
    `/reports/billing${buildQuery({ month, year })}`,
  );
}

export function getOrdersSummary() {
  return apiRequest<OrdersSummary>("/reports/summary");
}

// ─── All-orders report ───────────────────────────────────────────────────────

export interface AllOrdersRow {
  id: number;
  orderNumber: string;
  client: { id: number; name: string };
  createdAt: string;
  completedAt: string | null;
  total: string;
  honorario: string;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
}

export interface AllOrdersTotals {
  sumTotal: string;
  sumHonorario: string;
  totalReceived: string;
}

export interface AllOrdersResult {
  orders: AllOrdersRow[];
  totals: AllOrdersTotals;
}

export interface AllOrdersFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  clientId?: number;
}

export function getAllOrders(filters: AllOrdersFilters = {}) {
  return apiRequest<AllOrdersResult>(
    `/reports/orders${buildQuery({ ...filters })}`,
  );
}
