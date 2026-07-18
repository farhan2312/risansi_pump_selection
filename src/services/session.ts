import type { AuthUser } from "./authService";

const USER_KEY = "authUser";

/** The actual session lives in an httpOnly `auth_token` cookie (set by
 * /api/auth/login, verified by middleware.ts on every protected request) —
 * it's never readable or settable from client JS, so it can't be spoofed via
 * localStorage. What's stored here is just a display-only cache of the
 * logged-in user's name/email/role, so the UI doesn't need a round trip to
 * paint the sidebar. */
export const saveSession = (user: AuthUser) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem(USER_KEY);
};

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

/** Weak client-side hint only (defense in depth) — real enforcement is
 * middleware.ts rejecting requests without a valid cookie before any
 * protected page is served. */
export const isAuthenticated = (): boolean => getCurrentUser() !== null;

export const isAdmin = (): boolean => getCurrentUser()?.role === "admin";
