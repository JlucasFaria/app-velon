import { createContext, useContext } from "react";

export type UserRole = "ADMIN" | "OPERATOR" | "VIEWER";

export interface AuthUser {
  id: number;
  email: string;
  companyId: number | null;
  role: UserRole | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Stores a token pair received from register or refresh without re-calling the API. */
  setSession: (token: string, refreshToken: string) => void;
  /** Rotates the refresh token and updates the stored session (used after onboarding). */
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
