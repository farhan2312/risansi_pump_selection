"use client";

import type { ReactNode } from "react";
import Sidebar from "../components/layout/Sidebar";
import TopBar from "../components/layout/TopBar";
import BottomNav from "../components/layout/BottomNav";
import "./DashboardLayout.css";

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="dashboard-layout">
      {/* Sidebar on desktop, bottom bar on mobile — both are always rendered
          and swapped purely by CSS media queries, so there's no breakpoint
          state in JS to get out of sync (and no hydration mismatch). */}
      <Sidebar />

      <div className="dashboard-content">
        <TopBar />
        <main className="dashboard-main">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
};

export default DashboardLayout;
