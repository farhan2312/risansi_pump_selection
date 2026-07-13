"use client";

import type { ReactNode } from "react";

import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/layouts/DashboardLayout";

export default function DashboardGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthGuard>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthGuard>
  );
}
