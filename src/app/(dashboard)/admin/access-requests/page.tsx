"use client";

import AuthGuard from "@/components/auth/AuthGuard";
import AdminAccessRequestsPage from "@/screens/admin/AdminAccessRequestsPage";

export default function Page() {
  return (
    <AuthGuard adminOnly>
      <AdminAccessRequestsPage />
    </AuthGuard>
  );
}
