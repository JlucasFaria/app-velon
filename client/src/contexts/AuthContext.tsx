import { useState, useCallback, type ReactNode } from "react";
import * as authApi from "@/api/auth";
import { AuthContext, type AuthUser } from "./auth-context";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

/** Decodes the JWT payload into a user, or null if invalid/expired. */
function decodeUser(token: string): AuthUser | null {
  try {
    // JWT payloads are base64url-encoded — normalize to base64 before atob.
    const base64 = (token.split(".")[1] ?? "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const payload = JSON.parse(atob(base64)) as {
      id?: unknown;
      email?: unknown;
      exp?: unknown;
    };

    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      return null; // expired
    }
    if (typeof payload.id === "number" && typeof payload.email === "string") {
      return { id: payload.id, email: payload.email };
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Derive the initial session from a single check so token and user stay
  // consistent: a missing or expired token means no session at all.
  const initialUser = (() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    return token ? decodeUser(token) : null;
  })();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [accessToken, setAccessToken] = useState<string | null>(
    initialUser ? localStorage.getItem(ACCESS_TOKEN_KEY) : null,
  );

  const setSession = useCallback((token: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    setAccessToken(token);
    setUser(decodeUser(token));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, refreshToken } = await authApi.login(email, password);
    setSession(token, refreshToken);
  }, [setSession]);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // best-effort: clear local state even if the server call fails
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}
