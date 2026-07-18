"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useCurrentUser } from "../../contexts/CurrentUserContext";

interface AuthGuardProps {
  children: ReactNode;
  adminOnly?: boolean;
}

/**
 * Client-side route guard. The actual security boundary is middleware.ts,
 * which rejects unauthenticated requests to protected pages before they're
 * ever served — this only handles the adminOnly redirect UX and a fallback
 * in case /api/auth/me comes back empty (e.g. the cookie expired mid-session).
 */
const AuthGuard = ({ children, adminOnly = false }: AuthGuardProps) => {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (adminOnly && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [router, adminOnly, user, loading]);

  if (loading || !user) return null;
  if (adminOnly && user.role !== "admin") return null;

  return <>{children}</>;
};

export default AuthGuard;
