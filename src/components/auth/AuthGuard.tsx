"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { isAdmin, isAuthenticated } from "../../services/session";

interface AuthGuardProps {
  children: ReactNode;
  adminOnly?: boolean;
}

/**
 * Client-side route guard, replacing the old react-router ProtectedRoute /
 * AdminRoute. Auth state lives in localStorage (set at login), which is only
 * available in the browser — so we render nothing until mounted, then either
 * redirect or reveal the protected content.
 */
const AuthGuard = ({ children, adminOnly = false }: AuthGuardProps) => {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/");
      return;
    }
    if (adminOnly && !isAdmin()) {
      router.replace("/dashboard");
      return;
    }
    setAllowed(true);
  }, [router, adminOnly]);

  if (!allowed) return null;

  return <>{children}</>;
};

export default AuthGuard;
