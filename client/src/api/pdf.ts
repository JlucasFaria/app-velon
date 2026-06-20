// Fetches the OS PDF as a Blob and triggers a browser file download.
// Uses fetch directly because apiRequest unwraps JSON; PDFs are binary.
import { getAccessToken } from "@/lib/token-storage";

export async function downloadOrderPdf(orderId: number): Promise<void> {
  const token = getAccessToken();
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
