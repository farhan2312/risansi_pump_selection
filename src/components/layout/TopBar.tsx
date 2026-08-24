"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import "./TopBar.css";
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
        <div className="topbar-spacer" />
        <div className="topbar-actions">
          <button type="button" className="topbar-report-btn" onClick={() => setReportOpen(true)}>
            🐞 Report a Bug
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
