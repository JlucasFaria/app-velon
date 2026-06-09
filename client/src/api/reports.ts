import { apiRequest, buildQuery } from "./client";

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
