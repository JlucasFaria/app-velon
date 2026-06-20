import { useState, useEffect, useCallback, type ReactNode } from "react";
import * as authApi from "@/api/auth";
import {
  getAccessToken,
  getRefreshToken,
  isPersistentSession,
  setTokens,
  clearTokens,
} from "@/lib/token-storage";
import { AuthContext, type AuthUser, type UserRole } from "./auth-context";

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
      companyId?: unknown;
      role?: unknown;
      exp?: unknown;
    };

    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      return null; // expired
    }
    if (typeof payload.id === "number" && typeof payload.email === "string") {
      const validRoles: UserRole[] = ["ADMIN", "OPERATOR", "VIEWER"];
      return {
        id: payload.id,
        email: payload.email,
        name: null, // enriched from GET /auth/me once authenticated
        companyId:
          typeof payload.companyId === "number" ? payload.companyId : null,
        role:
          typeof payload.role === "string" &&
          validRoles.includes(payload.role as UserRole)
            ? (payload.role as UserRole)
            : null,
      };
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
    const token = getAccessToken();
    return token ? decodeUser(token) : null;
  })();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [accessToken, setAccessToken] = useState<string | null>(
    initialUser ? getAccessToken() : null,
  );

  // The JWT carries no display name, so enrich the user with it from /auth/me
  // whenever the session token changes (login, refresh, initial load).
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    authApi
      .me()
      .then((data) => {
        if (!cancelled) {
          setUser((prev) => (prev ? { ...prev, name: data.name } : prev));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const setSession = useCallback(
    (token: string, refreshToken: string, remember = isPersistentSession()) => {
      setTokens(token, refreshToken, remember);
      setAccessToken(token);
      setUser(decodeUser(token));
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string, remember = true) => {
      const { token, refreshToken } = await authApi.login(email, password);
      setSession(token, refreshToken, remember);
    },
    [setSession],
  );

  const refreshSession = useCallback(async () => {
    const storedRefreshToken = getRefreshToken();
    if (!storedRefreshToken) throw new Error("No refresh token");
    const { token, refreshToken } = await authApi.refresh(storedRefreshToken);
    setSession(token, refreshToken);
  }, [setSession]);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // best-effort: clear local state even if the server call fails
    }
    clearTokens();
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, setSession, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}
