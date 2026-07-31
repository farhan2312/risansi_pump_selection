"use client";

import { useEffect, useMemo, useState } from "react";
import WelcomeCard from "../../components/dashboard/WelcomeCard";
import StatsCard from "../../components/dashboard/StatsCard";
import { listProjects, type ProjectRecord } from "../../services/projectService";
import "./DashboardPage.css";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

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
        <StatsCard title="Total Projects" value={isLoading ? 0 : stats.total} />
        <StatsCard title="In Progress" value={isLoading ? 0 : stats.inProgress} />
        <StatsCard title="Completed" value={isLoading ? 0 : stats.completed} />
        <StatsCard title="Pending" value={isLoading ? 0 : stats.pending} />
      </div>

      <div className="dashboard-card">
        <h3>Recent Projects</h3>

        {isLoading && <p style={{ padding: "12px 16px" }}>Loading…</p>}
        {error && (
          <p style={{ padding: "12px 16px" }} className="error-message">
            {error}
          </p>
        )}
        {!isLoading && !error && recent.length === 0 && (
          <p style={{ padding: "12px 16px" }}>No projects yet.</p>
        )}

        {!isLoading && !error && recent.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Client Code</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {recent.map((p) => (
                <tr key={p.id}>
                  <td>{p.name || p.project_code}</td>
                  <td>{p.client_code || "—"}</td>
                  <td>{p.status || "—"}</td>
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
