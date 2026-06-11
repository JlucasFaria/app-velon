// Base fetch layer. Prepends /api (proxied to the backend by Vite in dev),
// injects the Authorization header, unwraps the { success, data } envelope,
// and bounces expired sessions to /login on 401.

const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = localStorage.getItem("accessToken");
  const { body, headers, ...rest } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let json: { data?: unknown; error?: unknown } | null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null; // non-JSON response (e.g. a proxy/network error page)
  }

  if (!res.ok) {
    const message =
      (json && typeof json.error === "string" && json.error) ||
      `Request failed (${res.status})`;

    // Only a 401 on an existing session means the token expired — clear it and
    // bounce to login. A 401 without a token is just a failed login attempt.
    if (res.status === 401 && token) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    throw new ApiError(message, res.status);
  }

  // Endpoints wrap payloads in { success, data, message } — unwrap to data.
  return (json?.data ?? json) as T;
}

/**
 * Multipart upload (e.g. company logo). Unlike apiRequest it must NOT set a
 * Content-Type header so the browser can add the multipart boundary itself.
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const token = localStorage.getItem("accessToken");

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const text = await res.text();
  let json: { data?: unknown; error?: unknown } | null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const message =
      (json && typeof json.error === "string" && json.error) ||
      `Request failed (${res.status})`;

    if (res.status === 401 && token) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    throw new ApiError(message, res.status);
  }

  return (json?.data ?? json) as T;
}

/** Builds a query string (with leading "?") from defined params, or "". */
export function buildQuery(
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
