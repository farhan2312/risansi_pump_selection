"use client";

import React, { useEffect, useMemo, useState } from "react";
import "./SelectionSummaryPage.css";
import {
  getReportSummary,
  listReports,
  reportDownloadUrl,
  type ReportRecord,
  type ReportSummary,
  type ReportSummaryField,
} from "../../services/reportsService";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import Spinner from "../../components/ui/Spinner";

// Reuses the exact status-pill classes/colors from DashboardPage.css (loaded
// globally, see app/layout.tsx) so status reads the same everywhere.
const statusPillClass = (status: string | null | undefined): string => {
  switch ((status ?? "").trim().toLowerCase()) {
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

// Roll up the tag statuses under one enquiry into a single enquiry-level
// status - same rule the /api/projects list uses server-side, mirrored here
// so the enquiry row and the nested tag rows agree.
function rollupTagStatuses(statuses: string[]): string {
  if (statuses.length === 0) return "—";
  const norm = (s: string) => (s || "").trim().toLowerCase();
  if (statuses.every((s) => norm(s) === "completed")) return "Completed";
  if (statuses.every((s) => norm(s) === "pending")) return "Pending";
  return "In Progress";
}

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// Reports grouped per enquiry, then per tag. A tag can have at most one
// generated Selection Summary report (enquiry_tags.id is unique, one row per
// tag), so a single enquiry shows one nested row per confirmed tag. Same
// chevron-expand pattern the Projects page uses for its own tag list.
const SelectionSummaryPage = () => {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<ReportRecord | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    listReports()
      .then((rows) => {
        if (!cancelled) setReports(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load reports.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (r) =>
        r.project_code.toLowerCase().includes(q) ||
        (r.project_name ?? "").toLowerCase().includes(q) ||
        (r.client_code ?? "").toLowerCase().includes(q) ||
        r.tag_name.toLowerCase().includes(q),
    );
  }, [reports, search]);

  // Group the flat per-tag list by enquiry so the outer table shows one row
  // per enquiry with the tag reports nested underneath. Enquiries are sorted
  // by their newest tag's generated_at so the most recent activity floats to
  // the top - matches the flat ordering the API returns.
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        project_id: string;
        project_code: string;
        project_name: string | null;
        client_code: string | null;
        created_by_name: string | null;
        latest_generated_at: string | null;
        tags: ReportRecord[];
      }
    >();
    for (const r of filtered) {
      let entry = map.get(r.project_id);
      if (!entry) {
        entry = {
          project_id: r.project_id,
          project_code: r.project_code,
          project_name: r.project_name,
          client_code: r.client_code,
          created_by_name: r.created_by_name,
          latest_generated_at: r.document_generated_at,
          tags: [],
        };
        map.set(r.project_id, entry);
      }
      entry.tags.push(r);
      if (
        r.document_generated_at &&
        (!entry.latest_generated_at ||
          r.document_generated_at > entry.latest_generated_at)
      ) {
        entry.latest_generated_at = r.document_generated_at;
      }
    }
    return [...map.values()].sort((a, b) =>
      (b.latest_generated_at ?? "").localeCompare(a.latest_generated_at ?? ""),
    );
  }, [filtered]);

  const toggleExpanded = (projectId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });

  return (
    <div className="summary-page">
      <div className="summary-header">
        <div>
          <h1>Reports</h1>
          <p>
            Enquiries with generated Selection Summary reports. Expand an
            enquiry to see each tag&apos;s report and download it.
          </p>
        </div>
        <input
          type="search"
          className="summary-search"
          placeholder="Search enquiry, name, client or tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="error-message">{error}</p>}

      {isLoading && (
        <div className="summary-panel">
          <div style={{ padding: 16 }}>
            <SkeletonRows rows={5} cols={6} />
          </div>
        </div>
      )}

      {!isLoading && !error && reports.length === 0 && (
        <EmptyState
          icon="table"
          title="No reports generated yet"
          description="Click Confirm Pump Selection on the last wizard step of a tag to generate and save its report here."
        />
      )}

      {!isLoading && !error && reports.length > 0 && (
        <div className="summary-panel">
          <table className="summary-table">
            <thead>
              <tr>
                <th aria-label="Expand" className="summary-chevron-col" />
                <th>Enquiry</th>
                <th>Client</th>
                <th>Status</th>
                <th>Latest Report</th>
                <th>Generated By</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => {
                const isOpen = expanded.has(g.project_id);
                const enquiryStatus = rollupTagStatuses(
                  g.tags.map((t) => t.status ?? ""),
                );
                return (
                  <React.Fragment key={g.project_id}>
                    <tr>
                      <td className="summary-chevron-col">
                        <button
                          type="button"
                          className={`summary-chevron${isOpen ? " is-open" : ""}`}
                          onClick={() => toggleExpanded(g.project_id)}
                          aria-expanded={isOpen}
                          aria-label={
                            isOpen ? "Hide tag reports" : "Show tag reports"
                          }
                        >
                          <ChevronIcon />
                        </button>
                      </td>
                      <td>
                        <span className="summary-project-code">
                          {g.project_code}
                        </span>
                        <span className="summary-project-name">
                          {g.project_name || "—"}
                        </span>
                      </td>
                      <td>{g.client_code || "—"}</td>
                      <td>
                        <span className={statusPillClass(enquiryStatus)}>
                          {enquiryStatus}
                        </span>
                      </td>
                      <td className="mono">{fmtDate(g.latest_generated_at)}</td>
                      <td>{g.created_by_name || "—"}</td>
                    </tr>
                    {isOpen && (
                      <tr className="summary-tags-row">
                        <td />
                        <td colSpan={5}>
                          <div className="summary-tags-panel">
                            <div className="summary-tags-heading">
                              {g.tags.length} tag{g.tags.length === 1 ? "" : "s"} with a saved report
                            </div>
                            <table className="summary-tags-table">
                              <thead>
                                <tr>
                                  <th>Tag</th>
                                  <th>Status</th>
                                  <th>Generated</th>
                                  <th className="summary-actions-col">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.tags.map((t) => (
                                  <tr
                                    key={t.tag_id}
                                    className="summary-row-clickable"
                                    onClick={() => setViewing(t)}
                                  >
                                    <td className="mono">{t.tag_name}</td>
                                    <td>
                                      <span className={statusPillClass(t.status)}>
                                        {t.status || "—"}
                                      </span>
                                    </td>
                                    <td className="mono">
                                      {fmtDate(t.document_generated_at)}
                                    </td>
                                    <td className="summary-actions-col">
                                      <a
                                        className="summary-download-btn"
                                        href={reportDownloadUrl(t.tag_id)}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Download
                                      </a>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {grouped.length === 0 && (
                <tr>
                  <td colSpan={6} className="summary-empty-cell">
                    <EmptyState
                      compact
                      icon="search"
                      title={`No reports match “${search}”`}
                      description="Try a different enquiry, name, client or tag."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <ReportSummaryModal report={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
};

// --- Summary modal -----------------------------------------------------

const SummaryFieldGrid = ({ items, pos }: { items: ReportSummaryField[]; pos?: boolean }) => {
  const filled = items.filter(([, v]) => v && String(v).trim() !== "");
  if (filled.length === 0) return null;
  return (
    <div className={`summary-modal-grid ${pos ? "summary-modal-grid-pos" : ""}`}>
      {filled.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
};

const ReportSummaryModal = ({
  report,
  onClose,
}: {
  report: ReportRecord;
  onClose: () => void;
}) => {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReportSummary(report.tag_id)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the report summary.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [report.tag_id]);

  return (
    <div className="summary-modal-overlay" onClick={onClose}>
      <div
        className="summary-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="summary-modal-header">
          <div>
            <h3>
              {report.project_code} <span className="summary-modal-tag">· {report.tag_name}</span>
            </h3>
            <p>{report.project_name || "—"}</p>
          </div>
          <button className="summary-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="summary-modal-body">
          {isLoading && (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <Spinner caption="Loading summary…" />
            </div>
          )}
          {!isLoading && error && <p className="error-message">{error}</p>}
          {!isLoading && !error && !summary && (
            <EmptyState
              compact
              icon="alert"
              title="No summary saved for this report"
              description="Older reports generated before this feature was added won't have one — the PDF download still works."
            />
          )}

          {!isLoading && !error && summary && (
            <>
              {summary.pumpFields.length > 0 && (
                <div className="summary-modal-section">
                  <span className="summary-modal-section-title">Pump Selection</span>
                  <SummaryFieldGrid items={summary.pumpFields} />
                </div>
              )}
              {summary.sections.map((section) => {
                const hasValue = section.items.some(([, v]) => v && String(v).trim() !== "");
                if (!hasValue) return null;
                return (
                  <div className="summary-modal-section" key={section.title}>
                    <span
                      className={`summary-modal-section-title ${
                        section.highlight ? "summary-modal-section-title-pos" : ""
                      }`}
                    >
                      {section.title}
                    </span>
                    <SummaryFieldGrid items={section.items} pos={section.highlight} />
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="summary-modal-footer">
          <a className="summary-download-btn" href={reportDownloadUrl(report.tag_id)}>
            Download PDF
          </a>
          <button className="summary-modal-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// The chevron ships as a right-arrow; the .summary-chevron.is-open class in
// SelectionSummaryPage.css rotates it 90 deg down when expanded.
const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M4.5 3l3 3-3 3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default SelectionSummaryPage;
