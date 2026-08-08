"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useCurrentUser } from "../../contexts/CurrentUserContext";

interface AuthGuardProps {
  children: ReactNode;
  /** admin or system_admin (the master-data pages). */
  adminOnly?: boolean;
  /** system_admin only (access requests) — stricter than adminOnly, per the
   * 3-role spec: "admin" explicitly does not get this. */
  systemAdminOnly?: boolean;
}

/**
 * Client-side route guard. The actual security boundary is middleware.ts,
 * which rejects unauthenticated requests to protected pages before they're
 * ever served — this only handles the adminOnly/systemAdminOnly redirect UX
 * and a fallback in case /api/auth/me comes back empty (e.g. the cookie
 * expired mid-session).
 */
const AuthGuard = ({ children, adminOnly = false, systemAdminOnly = false }: AuthGuardProps) => {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const isAdminLevel = user?.role === "admin" || user?.role === "system_admin";
  const isSystemAdmin = user?.role === "system_admin";
  const denied = (adminOnly && !isAdminLevel) || (systemAdminOnly && !isSystemAdmin);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (denied) {
      router.replace("/dashboard");
    }
  }, [router, denied, user, loading]);

  if (loading || !user) return null;
  if (denied) return null;

  return <>{children}</>;
};

export default AuthGuard;
