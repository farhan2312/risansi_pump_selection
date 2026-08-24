"use client";

import { useEffect, useMemo, useState } from "react";
import WelcomeCard from "../../components/dashboard/WelcomeCard";
import StatsCard from "../../components/dashboard/StatsCard";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { listProjects, type ProjectRecord } from "../../services/projectService";
import "./DashboardPage.css";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// Status → soft-tint pill class (see DashboardPage.css). Anything unmapped
// falls back to a neutral pill so we don't 500 on an unknown value.
const statusPillClass = (status: string | null | undefined): string => {
  switch (norm(status)) {
    case "in progress":
      return "status-pill status-in-progress";
    case "completed":
      return "status-pill status-completed";
    case "pending":
      return "status-pill status-pending";
    default:
      return "status-pill status-neutral";
  }
};

// True when `createdAt` falls within [from, to] — either bound may be blank
// (meaning "no limit that side"). `to` is treated as inclusive through the
// END of that day, since a plain date input has no time component.
const inDateRange = (createdAt: string | null, from: string, to: string): boolean => {
  if (!from && !to) return true;
  const t = createdAt ? new Date(createdAt).getTime() : NaN;
  if (Number.isNaN(t)) return false;
  if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && t > new Date(`${to}T23:59:59.999`).getTime()) return false;
  return true;
};

const DashboardPage = () => {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date-range filter — applies to both the stat cards and the Recent
  // Enquiries table below, scoped to each enquiry's created_at.
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = (isManualRefresh: boolean) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    return listProjects()
      .then(setProjects)
      .catch(() => setError("Couldn't load dashboard data."))
      .finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      });
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => projects.filter((p) => inDateRange(p.created_at, fromDate, toDate)),
    [projects, fromDate, toDate]
  );

  const stats = useMemo(() => {
    const byStatus = (status: string) =>
      filtered.filter((p) => norm(p.status) === status).length;
    return {
      total: filtered.length,
      inProgress: byStatus("in progress"),
      completed: byStatus("completed"),
      pending: byStatus("pending"),
    };
  }, [filtered]);

  // Most recent first — listProjects already orders by created_at desc, but
  // sort defensively so the "Recent" table is correct regardless.
  const recent = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 5),
    [filtered]
  );

  const hasDateFilter = fromDate !== "" || toDate !== "";

  return (
    <div className="dashboard-page">
      {/* Header row: greeting on the left, date-range filter + Refresh pinned
          to the top-right (inline, no surrounding panel). */}
      <div className="dashboard-header-row">
        <WelcomeCard />

        <div className="dashboard-filter">
          <div className="dashboard-filter-field">
            <label htmlFor="dashboard-from-date">From</label>
            <input
              id="dashboard-from-date"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="dashboard-filter-field">
            <label htmlFor="dashboard-to-date">To</label>
            <input
              id="dashboard-to-date"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="dashboard-refresh-btn"
            onClick={() => load(true)}
            disabled={isLoading || isRefreshing}
            aria-label="Refresh dashboard data"
          >
            <RefreshIcon spinning={isRefreshing} />
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>

          {hasDateFilter && (
            <button
              type="button"
              className="dashboard-filter-clear"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <StatsCard title="Total Enquiries" value={isLoading ? 0 : stats.total} />
        <StatsCard title="In Progress" value={isLoading ? 0 : stats.inProgress} />
        <StatsCard title="Completed" value={isLoading ? 0 : stats.completed} />
        <StatsCard title="Pending" value={isLoading ? 0 : stats.pending} />
      </div>

      <div className="dashboard-card">
        <h3>Recent Enquiries</h3>

        {isLoading && (
          <div style={{ padding: "16px" }}>
            <SkeletonRows rows={4} cols={3} />
          </div>
        )}
        {error && (
          <div className="dashboard-error" role="alert">
            {error}
          </div>
        )}
        {!isLoading && !error && recent.length === 0 && (
          <div style={{ padding: "16px" }}>
            <EmptyState
              compact
              icon="folder"
              title={hasDateFilter ? "No enquiries in this date range" : "No enquiries yet"}
              description={
                hasDateFilter
                  ? "Try widening or clearing the From / To date filter above."
                  : "Create your first enquiry from the Enquiries page to see it appear here."
              }
            />
          </div>
        )}

        {!isLoading && !error && recent.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Enquiry</th>
                <th>Client Code</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {recent.map((p) => (
                <tr key={p.id}>
                  <td>{p.name || p.project_code}</td>
                  <td>{p.client_code || "—"}</td>
                  <td>
                    <span className={statusPillClass(p.status)}>
                      {p.status || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={spinning ? "dashboard-refresh-icon spinning" : "dashboard-refresh-icon"}
  >
    <path
      d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default DashboardPage;
