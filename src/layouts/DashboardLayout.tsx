"use client";

import type { ReactNode } from "react";
import Sidebar from "../components/layout/Sidebar";
import "./DashboardLayout.css";

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="dashboard-layout">
      <Sidebar />

      <div className="dashboard-content">
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
