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

const DashboardPage = () => {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listProjects()
      .then((rows) => {
        if (!cancelled) setProjects(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load dashboard data.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const byStatus = (status: string) =>
      projects.filter((p) => norm(p.status) === status).length;
    return {
      total: projects.length,
      inProgress: byStatus("in progress"),
      completed: byStatus("completed"),
      pending: byStatus("pending"),
    };
  }, [projects]);

  // Most recent first — listProjects already orders by created_at desc, but
  // sort defensively so the "Recent" table is correct regardless.
  const recent = useMemo(
    () =>
      [...projects]
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 5),
    [projects]
  );

  return (
    <div className="dashboard-page">
      <WelcomeCard />

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
              title="No enquiries yet"
              description="Create your first enquiry from the Enquiries page to see it appear here."
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

export default DashboardPage;
