import { apiRequest } from "./client";

export interface TokenPair {
  token: string;
  refreshToken: string;
}

export interface MeData {
  id: number;
  email: string;
  name: string | null;
  hasCompany: boolean;
}

export function login(email: string, password: string) {
  return apiRequest<TokenPair>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function register(data: {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}) {
  return apiRequest<TokenPair>("/auth/register", {
    method: "POST",
    body: data,
  });
}

export function me() {
  return apiRequest<MeData>("/auth/me");
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

// Always resolves on 200 regardless of whether the email exists — the backend
// deliberately does not reveal that, so the UI shows the same confirmation.
export function forgotPassword(email: string) {
  return apiRequest<{ message?: string }>("/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
}

export function resetPassword(token: string, password: string) {
  return apiRequest<{ message?: string }>("/auth/reset-password", {
    method: "POST",
    body: { token, password },
  });
}

export interface UpdateMeInput {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface UpdateMeData {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export function updateMe(data: UpdateMeInput) {
  return apiRequest<UpdateMeData>("/users/me", {
    method: "PATCH",
    body: data,
  });
}
