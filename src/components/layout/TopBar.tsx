"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import "./TopBar.css";
import Breadcrumb from "./Breadcrumb";
import NotificationBell from "./NotificationBell";
import ReportBugModal from "../bug-report/ReportBugModal";

// Slim app-wide top bar: "Report a Bug" (any logged-in user) + the
// notification bell (a reporter's own status-change updates). Sits above
// every dashboard page's content, next to the sidebar.
const TopBar = () => {
  const pathname = usePathname();
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <>
      <div className="topbar">
        <Breadcrumb />
        <div className="topbar-actions">
          <button
            type="button"
            className="topbar-report-btn"
            onClick={() => setReportOpen(true)}
            aria-label="Report a Bug"
          >
            <span aria-hidden="true">🐞</span>
            <span className="topbar-report-label">Report a Bug</span>
          </button>
          <NotificationBell />
        </div>
      </div>

      <ReportBugModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        page={pathname ?? ""}
      />
    </>
  );
};

export default TopBar;
