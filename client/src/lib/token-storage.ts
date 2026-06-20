// Token persistence. The "Lembrar de mim" choice decides where the session
// lives: localStorage survives a browser restart, sessionStorage is cleared
// when the tab/window closes. Reads resolve whichever store holds the token, so
// the rest of the app never needs to know which one was chosen.

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

function read(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

export function getAccessToken(): string | null {
  return read(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return read(REFRESH_TOKEN_KEY);
}

/**
 * Whether the active session is persistent (lives in localStorage). Defaults to
 * true when there is no session yet, so flows without an explicit choice
 * (register, invite accept, token refresh) persist by default.
 */
export function isPersistentSession(): boolean {
  if (sessionStorage.getItem(ACCESS_TOKEN_KEY) !== null) return false;
  return true;
}

/**
 * Persists the token pair. `remember` picks the backing store; the other store
 * is cleared so a stale session can't linger after switching the choice.
 */
export function setTokens(
  accessToken: string,
  refreshToken: string,
  remember: boolean,
): void {
  const target = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  target.setItem(ACCESS_TOKEN_KEY, accessToken);
  target.setItem(REFRESH_TOKEN_KEY, refreshToken);
  other.removeItem(ACCESS_TOKEN_KEY);
  other.removeItem(REFRESH_TOKEN_KEY);
}

/** Removes the session from both stores. */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}
