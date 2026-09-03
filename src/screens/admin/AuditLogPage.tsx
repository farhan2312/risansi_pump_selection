"use client";

import { useEffect, useMemo, useState } from "react";
import "./AuditLogPage.css";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import {
  getAuditLog,
  type AuditEventRow,
  type AuditSummary,
  type AuditUsageRow,
} from "../../services/auditService";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

type TabKey = "usage" | "activity" | "logins" | "access";
type RangeKey = "today" | "7d" | "30d" | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "usage", label: "Usage by User" },
  { key: "activity", label: "Activity" },
  { key: "logins", label: "Logins & Sessions" },
  // The pump portal's equivalent of an "ownership changes" view: who was
  // granted, re-roled or lost access.
  { key: "access", label: "Access Changes" },
];

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All" },
];

const fmtWhen = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

/** "user.role_change" -> "Role change" — the dotted verb is for querying, not
 * for reading. */
const prettyAction = (action: string): string => {
  const tail = action.includes(".") ? action.slice(action.indexOf(".") + 1) : action;
  const words = tail.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const ROLE_LABELS: Record<string, string> = {
  system_admin: "System Admin",
  admin: "Admin",
  user: "User",
};
const prettyRole = (role: string | null | undefined): string =>
  role ? ROLE_LABELS[role] ?? role : "—";

const AuditLogPage = () => {
  const [tab, setTab] = useState<TabKey>("usage");
  const [range, setRange] = useState<RangeKey>("7d");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [usageRows, setUsageRows] = useState<AuditUsageRow[]>([]);
  const [eventRows, setEventRows] = useState<AuditEventRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getAuditLog({ tab, range, q: debouncedSearch.trim() })
      .then((res) => {
        if (cancelled) return;
        setSummary(res.summary);
        if (tab === "usage") {
          setUsageRows(res.rows as AuditUsageRow[]);
          setEventRows([]);
        } else {
          setEventRows(res.rows as AuditEventRow[]);
          setUsageRows([]);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the audit log.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, range, debouncedSearch]);

  const cards = useMemo(
    () => [
      { label: "Logins · 24h", value: summary?.logins24h ?? 0 },
      { label: "Failed · 24h", value: summary?.failed24h ?? 0, warn: (summary?.failed24h ?? 0) > 0 },
      { label: "Active Users · 24h", value: summary?.activeUsers24h ?? 0 },
      { label: "Actions · 24h", value: summary?.actions24h ?? 0 },
    ],
    [summary],
  );

  const rowCount = tab === "usage" ? usageRows.length : eventRows.length;

  return (
    <div className="audit-page">
      <div className="audit-header">
        <h1>Audit Log</h1>
        <p>Full activity trail · who signed in, when, and everything they did</p>
      </div>

      <div className="audit-cards">
        {cards.map((c) => (
          <div className="audit-card" key={c.label}>
            <span className="audit-card-label">{c.label}</span>
            <span className={`audit-card-value${c.warn ? " is-warn" : ""}`}>{c.value}</span>
          </div>
        ))}
      </div>

      <div className="audit-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`audit-tab${tab === t.key ? " is-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="audit-toolbar">
        <div className="audit-ranges">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`audit-chip${range === r.key ? " is-active" : ""}`}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="audit-search"
          placeholder={
            tab === "usage" ? "Search email, role…" : "Search email, action, detail…"
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="error-message">{error}</p>}

      {!error && (
        <>
          {!isLoading && (
            <div className="audit-count">
              {tab === "usage"
                ? `${rowCount} user${rowCount === 1 ? "" : "s"} active`
                : `${rowCount} event${rowCount === 1 ? "" : "s"}`}
            </div>
          )}

          <div className="audit-panel">
            {isLoading && (
              <div style={{ padding: 16 }}>
                <SkeletonRows rows={5} cols={5} />
              </div>
            )}

            {!isLoading && rowCount === 0 && (
              <EmptyState
                compact
                icon="search"
                title="Nothing recorded for this view"
                description="Activity is recorded from the moment auditing went live — older work won't appear. Try a wider date range."
              />
            )}

            {!isLoading && tab === "usage" && usageRows.length > 0 && (
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th className="num">Actions</th>
                    <th className="num">Sessions</th>
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {usageRows.map((r) => (
                    <tr key={r.email ?? "unknown"}>
                      <td className="mono">{r.email ?? "—"}</td>
                      <td>{prettyRole(r.role)}</td>
                      <td className="num">{r.actions}</td>
                      <td className="num">{r.sessions}</td>
                      <td className="mono">{fmtWhen(r.lastActive)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!isLoading && tab !== "usage" && eventRows.length > 0 && (
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Detail</th>
                    {tab === "logins" && <th>IP</th>}
                  </tr>
                </thead>
                <tbody>
                  {eventRows.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{fmtWhen(r.createdAt)}</td>
                      <td className="mono">{r.email ?? "—"}</td>
                      <td>
                        <span
                          className={`audit-action${
                            r.eventType === "login_failed" ? " is-failed" : ""
                          }`}
                        >
                          {prettyAction(r.action)}
                        </span>
                      </td>
                      <td className="audit-detail">{r.detail ?? "—"}</td>
                      {tab === "logins" && <td className="mono">{r.ip ?? "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!isLoading && rowCount > 0 && (
            <p className="audit-footnote">
              Showing 1–{rowCount} of {rowCount}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default AuditLogPage;
