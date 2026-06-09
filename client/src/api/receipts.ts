import { apiRequest } from "./client";

export interface Receipt {
  id: number;
  receiptNumber: number;
  issuedAt: string;
  order: {
    id: number;
    orderNumber: string;
    description: string;
    value: string;
    client: {
      id: number;
      name: string;
      document: string;
    };
  };
}

/** Generates the receipt for an order, or returns the existing one (idempotent). */
export function generateReceipt(orderId: number) {
  return apiRequest<Receipt>(`/orders/${orderId}/receipt`, { method: "POST" });
}

export function getReceipt(orderId: number) {
  return apiRequest<Receipt>(`/orders/${orderId}/receipt`);
}
