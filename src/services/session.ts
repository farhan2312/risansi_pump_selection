import type { AuthUser } from "./authService";

const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

export const saveSession = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getToken = (): string | null =>
  typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);

export const getCurrentUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

/** Reads the `exp` claim out of a JWT without verifying its signature —
 * enough to reject expired or malformed/fabricated tokens client-side.
 * Real signature verification still happens server-side on every API call. */
const getTokenExpiry = (token: string): number | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  const token = getToken();
  if (!token || getCurrentUser() === null) return false;

  const exp = getTokenExpiry(token);
  if (exp === null) return false;

  return exp * 1000 > Date.now();
};

export const isAdmin = (): boolean => getCurrentUser()?.role === "admin";
