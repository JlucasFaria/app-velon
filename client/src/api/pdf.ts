import { apiRequest } from "./client";

export interface PdfShareResult {
  url: string;
  expiresAt: string;
}

// Fetches the OS PDF as a Blob and triggers a browser file download.
// Uses fetch directly because apiRequest unwraps JSON; PDFs are binary.
export async function downloadOrderPdf(orderId: number): Promise<void> {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(`/api/pdf/orders/${orderId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (typeof j.error === "string") message = j.error;
    } catch {
      /* non-JSON */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  a.href = url;
  a.download = match?.[1] ?? `OS-${orderId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function getOrderShareLink(orderId: number): Promise<PdfShareResult> {
  return apiRequest<PdfShareResult>(`/pdf/orders/${orderId}/share`, {
    method: "POST",
  });
}

export interface SendEmailInput {
  to: string;
  subject?: string;
  body?: string;
}

export function sendOrderByEmail(
  orderId: number,
  input: SendEmailInput,
): Promise<PdfShareResult> {
  return apiRequest<PdfShareResult>(`/pdf/orders/${orderId}/email`, {
    method: "POST",
    body: input,
  });
}
