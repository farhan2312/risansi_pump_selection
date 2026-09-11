"use client";

import { useEffect, useMemo, useState } from "react";
import "./AuditLogPage.css";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { SkeletonRows } from "../../components/ui/Skeleton";
import {
  getAuditLog,
  getAuditReport,
  type AuditEventRow,
  type AuditSummary,
  type AuditUsageRow,
} from "../../services/auditService";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useCurrentUser } from "../../contexts/CurrentUserContext";
import { formatDuration } from "../../lib/duration";
import { downloadAuditReportPdf } from "../../lib/audit-report-pdf";

type TabKey = "usage" | "activity" | "logins" | "access";
type RangeKey = "today" | "7d" | "30d" | "all";

// Rows per page. The server pages to the same size; this only labels the bar.
const PAGE_SIZE = 30;

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

/**
 * A picked calendar date -> the instant it starts or ends IN THE USER'S TIME
 * ZONE. `new Date("2026-09-01")` would be UTC midnight, which is the wrong day
 * for anyone east or west of UTC, so the parts are built explicitly.
 */
const dayBoundary = (ymd: string, edge: "start" | "end"): string | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const dt =
    edge === "start" ? new Date(y, mo, d, 0, 0, 0, 0) : new Date(y, mo, d, 23, 59, 59, 999);
  return dt.toISOString();
};

/** The enquiry + tag an event touched, as one line. */
const enquiryTagText = (r: AuditEventRow): string | null => {
  if (!r.enquiryCode && !r.tagName) return null;
  return [r.enquiryCode, r.tagName].filter(Boolean).join(" · ");
};

const AuditLogPage = () => {
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<TabKey>("usage");
  const [range, setRange] = useState<RangeKey>("7d");
  // Explicit From/To dates (YYYY-MM-DD, from <input type="date">). When either
  // is set it overrides the quick range chip.
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [showActiveHelp, setShowActiveHelp] = useState(false);

  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [usageRows, setUsageRows] = useState<AuditUsageRow[]>([]);
  const [eventRows, setEventRows] = useState<AuditEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const customDates = Boolean(fromDate || toDate);
  const timeWindow = useMemo(
    () => ({
      range,
      from: fromDate ? dayBoundary(fromDate, "start") : undefined,
      to: toDate ? dayBoundary(toDate, "end") : undefined,
    }),
    [range, fromDate, toDate],
  );

  // Any filter change goes back to page 1 - a narrower filter can leave the
  // current page past the end of the results.
  const filterKey = `${tab}|${timeWindow.range}|${timeWindow.from}|${timeWindow.to}|${debouncedSearch.trim()}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    // Reset during render (not in an effect) so the fetch below never fires
    // once for the stale page number first.
    setLastFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getAuditLog({ tab, ...timeWindow, q: debouncedSearch.trim(), page })
      .then((res) => {
        if (cancelled) return;
        setSummary(res.summary);
        setTotal(res.total);
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
  }, [tab, timeWindow, debouncedSearch, page]);

  // The report covers the same window as the table, across EVERY section - not
  // just the tab in view - so it is a complete record for that period.
  const handleGenerateReport = async () => {
    if (generating) return;
    setGenerating(true);
    setReportError(null);
    try {
      const report = await getAuditReport(timeWindow);
      await downloadAuditReportPdf({ report, generatedBy: user?.name || user?.email });
    } catch {
      setReportError("Couldn't generate the report. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const cards = useMemo(
    () => [
      { label: "Logins · 24h", value: summary?.logins24h ?? 0 },
      { label: "Failed · 24h", value: summary?.failed24h ?? 0, warn: (summary?.failed24h ?? 0) > 0 },
      { label: "Active Users · 24h", value: summary?.activeUsers24h ?? 0 },
      { label: "Actions · 24h", value: summary?.actions24h ?? 0 },
    ],
    [summary],
  );

  const pageRows = tab === "usage" ? usageRows.length : eventRows.length;
  const windowLabel = customDates
    ? `${fromDate || "the beginning"} to ${toDate || "today"}`
    : RANGES.find((r) => r.key === range)?.label ?? range;

  const pickRange = (key: RangeKey) => {
    setRange(key);
    // A quick range replaces any custom dates, rather than silently being
    // overridden by them.
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="audit-page">
      <div className="audit-header">
        <div>
          <h1>Audit Log</h1>
          <p>Full activity trail · who signed in, when, and everything they did</p>
        </div>
        <button
          type="button"
          className="audit-report-btn"
          onClick={() => void handleGenerateReport()}
          disabled={generating}
          title={`Download a detailed PDF for: ${windowLabel}`}
        >
          {generating ? "Generating…" : "Generate Report"}
        </button>
      </div>

      {reportError && <p className="error-message">{reportError}</p>}

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
              // A chip only reads as selected when no custom dates are in force.
              className={`audit-chip${!customDates && range === r.key ? " is-active" : ""}`}
              onClick={() => pickRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className={`audit-dates${customDates ? " is-active" : ""}`}>
          <label>
            <span>From</span>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
          {customDates && (
            <button
              type="button"
              className="audit-dates-clear"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
            >
              Clear
            </button>
          )}
        </div>

        <input
          type="search"
          className="audit-search"
          placeholder={
            tab === "usage" ? "Search email, role…" : "Search email, enquiry, tag, action…"
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
                ? `${total} user${total === 1 ? "" : "s"} active · ${windowLabel}`
                : `${total} event${total === 1 ? "" : "s"} · ${windowLabel}`}
            </div>
          )}

          {tab === "usage" && (
            <div className="audit-help">
              <button
                type="button"
                className="audit-help-toggle"
                onClick={() => setShowActiveHelp((v) => !v)}
                aria-expanded={showActiveHelp}
              >
                {showActiveHelp ? "Hide" : "How is Active Time calculated?"}
              </button>
              {showActiveHelp && (
                <div className="audit-help-body">
                  <p>
                    <strong>Active Time is estimated from activity, not from sign-in to
                    sign-out.</strong>{" "}
                    Sign-outs are almost never recorded — people close the browser tab —
                    so session length can’t be measured directly.
                  </p>
                  <ol>
                    <li>Every action a user takes (saving a step, generating a report, signing in…) is recorded with a time. Failed sign-ins are not counted.</li>
                    <li>Those times are put in order and the gap between each one and the next is measured.</li>
                    <li>
                      Gaps of <strong>15 minutes or less</strong> are added up as active time.
                      A longer gap means they stepped away, so it counts as idle.
                    </li>
                  </ol>
                  <p className="audit-help-example">
                    Example: saves at 10:00, 10:04, 10:09 and then 11:30. The 4 and 5 minute
                    gaps count (9 min); the 81 minute gap is idle. Active Time = 9m.
                  </p>
                  <p className="audit-help-note">
                    It’s a conservative figure: time spent reading or filling a form before the
                    first save after a break isn’t visible to the audit trail.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="audit-panel">
            {isLoading && (
              <div style={{ padding: 16 }}>
                <SkeletonRows rows={5} cols={5} />
              </div>
            )}

            {!isLoading && pageRows === 0 && (
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
                    <th
                      className="num"
                      title="Estimated from activity: gaps of 15 minutes or less between a user's actions are added up. See 'How is Active Time calculated?' above."
                    >
                      Active Time
                    </th>
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
                      <td className="num mono">{formatDuration(r.activeSeconds)}</td>
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
                    {tab !== "logins" && <th>Enquiry / Tag</th>}
                    <th>Detail</th>
                    {tab === "logins" && <th>IP</th>}
                  </tr>
                </thead>
                <tbody>
                  {eventRows.map((r) => {
                    const where = enquiryTagText(r);
                    return (
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
                        {tab !== "logins" && (
                          <td className="audit-where">
                            {where ? (
                              <>
                                <span className="mono">{where}</span>
                                {r.clientName && (
                                  <span className="audit-where-client">{r.clientName}</span>
                                )}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        )}
                        <td className="audit-detail">{r.detail ?? "—"}</td>
                        {tab === "logins" && <td className="mono">{r.ip ?? "—"}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {!isLoading && (
              <Pagination
                page={page}
                totalItems={total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                itemLabel={tab === "usage" ? "users" : "events"}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogPage;
