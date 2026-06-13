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
  honorario: string;
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
  totalHonorario: string;
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
  partnerName?: string;
}

export function getAllOrders(filters: AllOrdersFilters = {}) {
  return apiRequest<AllOrdersResult>(
    `/reports/orders${buildQuery({ ...filters })}`,
  );
}

export async function downloadAllOrdersExport(
  format: "csv" | "pdf",
  filters: AllOrdersFilters = {},
): Promise<void> {
  const token = localStorage.getItem("accessToken");
  const url = `/api/reports/orders/export/${format}${buildQuery({ ...filters })}`;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const text = await res.text();
    let message = `Erro ao exportar (${res.status})`;
    try {
      const json = JSON.parse(text) as { error?: unknown };
      if (typeof json.error === "string") message = json.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const filename = `relatorio-os-${new Date().toISOString().slice(0, 10)}.${format}`;
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}
