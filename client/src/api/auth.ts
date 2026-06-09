import { apiRequest } from "./client";

export interface TokenPair {
  token: string;
  refreshToken: string;
}

export function login(email: string, password: string) {
  return apiRequest<TokenPair>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function refresh(refreshToken: string) {
  return apiRequest<TokenPair>("/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });
}

export function logout(refreshToken: string) {
  return apiRequest<{ message?: string }>("/auth/logout", {
    method: "POST",
    body: { refreshToken },
  });
}
