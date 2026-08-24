"use client";

import { useEffect, useMemo, useState } from "react";
import "./BugTrackerPage.css";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import {
  getBugReportScreenshotUrl,
  listBugReports,
  updateBugReportStatus,
  type BugReportRow,
  type BugReportStatus,
} from "../../services/bugReportService";

const FILTERS: ("All" | BugReportStatus)[] = ["All", "Open", "In progress", "Resolved", "Closed"];
const STATUSES: BugReportStatus[] = ["Open", "In progress", "Resolved", "Closed"];

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

// system_admin only — gated by middleware (/admin/bug-tracker) and by the
// underlying GET /api/bug-reports route itself. Lists every report filed
// from the "Report a Bug" button across the portal; changing a row's status
// here is what lights up the reporter's bell (see NotificationBell.tsx).
const BugTrackerPage = () => {
  const [reports, setReports] = useState<BugReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | BugReportStatus>("All");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    setError(null);
    listBugReports()
      .then(setReports)
      .catch(() => setError("Couldn't load bug reports."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => (filter === "All" ? reports : reports.filter((r) => r.status === filter)),
    [reports, filter],
  );

  const handleStatusChange = async (id: string, status: BugReportStatus) => {
    setSavingId(id);
    try {
      const updated = await updateBugReportStatus(id, status);
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: updated.status, updatedAt: updated.updatedAt } : r)),
      );
    } catch {
      // Best-effort — the select will just show the pre-change value again
      // since we didn't optimistically update.
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="bug-tracker-page">
      <h1>Bug Tracker</h1>
      <p>Reports filed from the &quot;Report a Bug&quot; button across the portal.</p>

      <div className="bug-tracker-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? "active" : ""}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="bug-tracker-panel">
          <div style={{ padding: 16 }}>
            <SkeletonRows rows={6} cols={5} />
          </div>
        </div>
      )}

      {!isLoading && error && <div className="bug-tracker-error">{error}</div>}

      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState
          icon="folder"
          title={reports.length === 0 ? "No reports yet" : `No ${filter} reports`}
          description={
            reports.length === 0
              ? "Reports filed from the Report a Bug button will show up here."
              : "Try a different filter."
          }
        />
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="bug-tracker-panel">
          <ul className="bug-tracker-list">
            {filtered.map((r) => {
              const expanded = expandedId === r.id;
              return (
                <li key={r.id} className="bug-tracker-row">
                  <button
                    type="button"
                    className="bug-tracker-row-summary"
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                  >
                    <span className={`bug-type-badge type-${r.type}`}>
                      {r.type === "feature" ? "💡" : "🐞"}
                    </span>
                    <span className="bug-tracker-title">{r.title}</span>
                    <span className={`bug-severity-badge sev-${r.severity.toLowerCase()}`}>
                      {r.severity}
                    </span>
                    <span className="bug-tracker-reporter">{r.reportedByName || "—"}</span>
                    <span className="bug-tracker-date">{fmt(r.createdAt)}</span>
                  </button>

                  <div className="bug-tracker-row-actions">
                    <select
                      value={r.status}
                      disabled={savingId === r.id}
                      onChange={(e) => handleStatusChange(r.id, e.target.value as BugReportStatus)}
                      className={`bug-status-select status-${r.status.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {expanded && (
                    <div className="bug-tracker-detail">
                      <p>{r.description || "No description provided."}</p>
                      <div className="bug-tracker-detail-meta">
                        {r.page && (
                          <span>
                            <b>Page:</b> {r.page}
                          </span>
                        )}
                      </div>
                      {r.screenshotFileName && (
                        <a
                          href={getBugReportScreenshotUrl(r.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="bug-tracker-screenshot-link"
                        >
                          <img
                            src={getBugReportScreenshotUrl(r.id)}
                            alt="Attached screenshot"
                          />
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default BugTrackerPage;
