"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import EmptyState from "../../components/ui/EmptyState";
import {
  getBugReportScreenshotUrl,
  listBugReports,
  updateBugReportStatus,
  type BugReportRow,
  type BugReportSeverity,
  type BugReportStatus,
  type BugReportType,
} from "../../services/bugReportService";

const STATUSES: BugReportStatus[] = ["Open", "In progress", "Resolved", "Closed"];
const SEVERITIES: BugReportSeverity[] = ["Critical", "High", "Medium", "Low"];
const SEVERITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

// Column accent + the soft chip used for that status elsewhere on the page.
const STATUS_STYLE: Record<BugReportStatus, { dot: string; chip: string; drop: string }> = {
  Open: {
    dot: "bg-[var(--brand-blue)]",
    chip: "bg-accent-soft text-accent",
    drop: "ring-[var(--brand-blue)]",
  },
  "In progress": {
    dot: "bg-warn",
    chip: "bg-[var(--warn-soft)] text-warn",
    drop: "ring-[var(--warn)]",
  },
  Resolved: {
    dot: "bg-pos",
    chip: "bg-[var(--pos-soft)] text-pos",
    drop: "ring-[var(--pos)]",
  },
  Closed: {
    dot: "bg-fg-4",
    chip: "bg-sunk text-fg-2",
    drop: "ring-[var(--fg-4)]",
  },
};

const SEVERITY_STYLE: Record<string, string> = {
  Critical: "bg-[var(--neg-soft)] text-neg",
  High: "bg-[color-mix(in_srgb,#f97316_16%,transparent)] text-[#ea580c]",
  Medium: "bg-[var(--warn-soft)] text-warn",
  Low: "bg-sunk text-fg-2",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const initials = (name: string | null) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const TypeIcon = ({ type }: { type: BugReportType }) => (
  <span
    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[13px] ${
      type === "feature" ? "bg-[var(--warn-soft)]" : "bg-[var(--neg-soft)]"
    }`}
    title={type === "feature" ? "Feature request" : "Bug"}
  >
    {type === "feature" ? "💡" : "🐞"}
  </span>
);

const SeverityBadge = ({ severity }: { severity: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap ${
      SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.Low
    }`}
  >
    {severity}
  </span>
);

// system_admin only — gated by middleware (/admin/bug-tracker) and by the
// underlying GET /api/bug-reports route itself. Lists every report filed
// from the "Report a Bug" button across the portal; changing a report's status
// here (drag to another column, or from the details popup) is what lights up
// the reporter's bell (see NotificationBell.tsx).
const BugTrackerPage = () => {
  const [reports, setReports] = useState<BugReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | BugReportType>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | BugReportSeverity>("all");

  const [savingId, setSavingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<BugReportStatus | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    listBugReports()
      .then(setReports)
      .catch(() => setError("Couldn't load bug reports."))
      .finally(() => setIsLoading(false));
  }, []);

  // Esc closes the details popup.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter(
      (r) =>
        (typeFilter === "all" || r.type === typeFilter) &&
        (severityFilter === "all" || r.severity === severityFilter) &&
        (!q ||
          r.title.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q) ||
          (r.reportedByName ?? "").toLowerCase().includes(q) ||
          (r.page ?? "").toLowerCase().includes(q)),
    );
  }, [reports, search, typeFilter, severityFilter]);

  // Within a column: most severe first, then newest.
  const columns = useMemo(() => {
    const by = new Map<BugReportStatus, BugReportRow[]>(STATUSES.map((s) => [s, []]));
    for (const r of filtered) (by.get(r.status) ?? by.get("Open")!).push(r);
    for (const list of by.values()) {
      list.sort(
        (a, b) =>
          (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) ||
          b.createdAt.localeCompare(a.createdAt),
      );
    }
    return by;
  }, [filtered]);

  const openReport = reports.find((r) => r.id === openId) ?? null;

  /** Optimistic: the card moves at once and snaps back if the save fails. */
  const moveTo = async (id: string, status: BugReportStatus) => {
    const current = reports.find((r) => r.id === id);
    if (!current || current.status === status) return;
    setSaveError(null);
    setSavingId(id);
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      const updated = await updateBugReportStatus(id, status);
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: updated.status, updatedAt: updated.updatedAt } : r)),
      );
    } catch {
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: current.status } : r)));
      setSaveError(`Couldn't move "${current.title}". Please try again.`);
    } finally {
      setSavingId(null);
    }
  };

  const onDrop = (e: DragEvent, status: BugReportStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDropTarget(null);
    setDragId(null);
    if (id) void moveTo(id, status);
  };

  const openCount = reports.filter((r) => r.status === "Open" || r.status === "In progress").length;
  const criticalOpen = reports.filter(
    (r) => (r.status === "Open" || r.status === "In progress") && r.severity === "Critical",
  ).length;
  const filtersOn = Boolean(search.trim()) || typeFilter !== "all" || severityFilter !== "all";

  const selectCls =
    "rounded-lg border border-line bg-paper px-2.5 py-2 text-[12.5px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft";

  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-5 pb-10 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-fg">Bug Tracker</h1>
          <p className="mt-0.5 text-[13px] text-fg-3">
            Reports filed from the &quot;Report a Bug&quot; button across the portal · drag a card to change its status
          </p>
        </div>
        {!isLoading && !error && (
          <div className="flex gap-2">
            <div className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12px] text-fg-3">
              <b className="font-mono text-[15px] text-fg">{openCount}</b> open
            </div>
            {criticalOpen > 0 && (
              <div className="rounded-lg border border-[var(--neg-soft)] bg-[var(--neg-soft)] px-3 py-1.5 text-[12px] text-neg">
                <b className="font-mono text-[15px]">{criticalOpen}</b> critical
              </div>
            )}
            <div className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12px] text-fg-3">
              <b className="font-mono text-[15px] text-fg">{reports.length}</b> total
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex rounded-lg border border-line bg-paper p-0.5">
          {(["board", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                view === v ? "bg-accent text-white" : "text-fg-3 hover:bg-elev hover:text-fg"
              }`}
            >
              {v === "board" ? "Board" : "List"}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, description, reporter, page…"
          className="min-w-[220px] flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-fg outline-none placeholder:text-fg-4 focus:border-accent focus:ring-2 focus:ring-accent-soft sm:max-w-[340px]"
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className={selectCls}>
          <option value="all">All types</option>
          <option value="bug">Bugs</option>
          <option value="feature">Feature requests</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
          className={selectCls}
        >
          <option value="all">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {filtersOn && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setTypeFilter("all");
              setSeverityFilter("all");
            }}
            className="rounded-md px-2 py-1.5 text-[12.5px] font-semibold text-accent hover:bg-accent-soft"
          >
            Clear filters
          </button>
        )}
      </div>

      {saveError && (
        <div className="mt-3 rounded-lg bg-[var(--neg-soft)] px-4 py-2.5 text-[13px] font-medium text-neg">{saveError}</div>
      )}
      {error && (
        <div className="mt-4 rounded-lg bg-[var(--neg-soft)] px-4 py-3 text-[13px] font-medium text-neg">{error}</div>
      )}

      {isLoading && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((s) => (
            <div key={s} className="h-[320px] animate-pulse rounded-xl border border-line bg-paper" />
          ))}
        </div>
      )}

      {!isLoading && !error && reports.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon="folder"
            title="No reports yet"
            description="Reports filed from the Report a Bug button will show up here."
          />
        </div>
      )}

      {/* Board */}
      {!isLoading && !error && reports.length > 0 && view === "board" && (
        <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((status) => {
            const cards = columns.get(status) ?? [];
            const style = STATUS_STYLE[status];
            const isTarget = dropTarget === status;
            return (
              <section
                key={status}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dropTarget !== status) setDropTarget(status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
                }}
                onDrop={(e) => onDrop(e, status)}
                className={`flex min-h-[260px] flex-col rounded-xl border bg-sunk/50 transition-shadow ${
                  isTarget ? `border-transparent ring-2 ${style.drop}` : "border-line"
                }`}
              >
                <header className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                    <h2 className="text-[13px] font-semibold text-fg">{status}</h2>
                    <span className="rounded-full bg-paper px-2 py-0.5 font-mono text-[11px] font-semibold text-fg-3">
                      {cards.length}
                    </span>
                  </div>
                </header>

                <div className="flex flex-1 flex-col gap-2.5 px-2.5 pb-3">
                  {cards.length === 0 && (
                    <div
                      className={`flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-8 text-center text-[12px] ${
                        isTarget ? "border-accent text-accent" : "border-line-strong text-fg-4"
                      }`}
                    >
                      {isTarget ? "Drop here" : filtersOn ? "No matching reports" : "Nothing here"}
                    </div>
                  )}

                  {cards.map((r) => (
                    <article
                      key={r.id}
                      draggable={savingId !== r.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", r.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(r.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropTarget(null);
                      }}
                      onClick={() => setOpenId(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenId(r.id);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`${r.title} — ${r.severity}, ${r.status}`}
                      className={`group cursor-grab rounded-lg border border-line bg-paper p-3 text-left shadow-[0_1px_2px_rgba(10,22,40,0.05)] transition hover:-translate-y-px hover:border-line-strong hover:shadow-[0_6px_16px_rgba(10,22,40,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing ${
                        dragId === r.id ? "opacity-40" : ""
                      } ${savingId === r.id ? "animate-pulse" : ""} ${
                        r.severity === "Critical" && (status === "Open" || status === "In progress")
                          ? "border-l-[3px] border-l-[var(--neg)]"
                          : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <TypeIcon type={r.type} />
                        <h3 className="line-clamp-2 flex-1 text-[13px] leading-snug font-semibold text-fg">{r.title}</h3>
                      </div>
                      {r.description && (
                        <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-fg-3">{r.description}</p>
                      )}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <SeverityBadge severity={r.severity} />
                        {r.page && (
                          <span className="max-w-[140px] truncate rounded bg-elev px-1.5 py-0.5 font-mono text-[10.5px] text-fg-3" title={r.page}>
                            {r.page}
                          </span>
                        )}
                        {r.screenshotFileName && (
                          <span className="text-[11px] text-fg-3" title="Has a screenshot">
                            📎
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-cyan)] text-[9px] font-bold text-white">
                            {initials(r.reportedByName)}
                          </span>
                          <span className="truncate text-[11.5px] text-fg-2">{r.reportedByName || "Unknown"}</span>
                        </span>
                        <span className="shrink-0 text-[11px] text-fg-3" title={fmt(r.createdAt)}>
                          {ago(r.createdAt)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* List */}
      {!isLoading && !error && reports.length > 0 && view === "list" && (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-paper">
          {filtered.length === 0 ? (
            <EmptyState compact icon="search" title="No matching reports" description="Try a different filter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {["", "Title", "Severity", "Reported by", "Filed", "Status"].map((h) => (
                      <th
                        key={h}
                        className="border-b border-line bg-elev px-4 py-2.5 text-left text-[10.5px] font-semibold tracking-[0.08em] whitespace-nowrap text-fg-3 uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((r) => (
                    <tr key={r.id} className="cursor-pointer transition-colors hover:bg-elev" onClick={() => setOpenId(r.id)}>
                      <td className="w-10 px-4 py-2.5">
                        <TypeIcon type={r.type} />
                      </td>
                      <td className="max-w-[420px] px-4 py-2.5">
                        <div className="truncate font-medium text-fg">{r.title}</div>
                        {r.page && <div className="truncate font-mono text-[11px] text-fg-3">{r.page}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <SeverityBadge severity={r.severity} />
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-fg-2">{r.reportedByName || "—"}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-fg-2" title={fmt(r.createdAt)}>
                        {ago(r.createdAt)}
                      </td>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={r.status}
                          disabled={savingId === r.id}
                          onChange={(e) => void moveTo(r.id, e.target.value as BugReportStatus)}
                          className={`rounded-full border-0 px-2.5 py-1 text-[12px] font-semibold outline-none ${STATUS_STYLE[r.status].chip}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Details popup */}
      {openReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,22,40,0.55)] p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={openReport.title}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-2xl border border-line bg-paper shadow-[0_24px_64px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-start gap-3 border-b border-line px-5 py-4">
              <TypeIcon type={openReport.type} />
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] leading-snug font-semibold text-fg">{openReport.title}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
                  <SeverityBadge severity={openReport.severity} />
                  <span>{openReport.type === "feature" ? "Feature request" : "Bug"}</span>
                  <span>·</span>
                  <span>
                    by {openReport.reportedByName || "Unknown"} · {fmt(openReport.createdAt)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                aria-label="Close"
                className="rounded-md px-2 py-1 text-[18px] leading-none text-fg-3 hover:bg-elev hover:text-fg"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-fg-3 uppercase">Status</div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => {
                    const active = openReport.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={savingId === openReport.id}
                        onClick={() => void moveTo(openReport.id, s)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition disabled:opacity-60 ${
                          active
                            ? `border-transparent ${STATUS_STYLE[s].chip}`
                            : "border-line text-fg-3 hover:border-line-strong hover:text-fg"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[s].dot}`} />
                        {s}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11.5px] text-fg-3">The reporter is notified when the status changes.</p>
              </div>

              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-fg-3 uppercase">Description</div>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-fg-2">
                  {openReport.description || "No description provided."}
                </p>
              </div>

              {openReport.page && (
                <div>
                  <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-fg-3 uppercase">Page</div>
                  <span className="rounded bg-elev px-2 py-1 font-mono text-[12px] text-fg-2">{openReport.page}</span>
                </div>
              )}

              {openReport.screenshotFileName && (
                <div>
                  <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-fg-3 uppercase">Screenshot</div>
                  <a
                    href={getBugReportScreenshotUrl(openReport.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg border border-line"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getBugReportScreenshotUrl(openReport.id)}
                      alt="Attached screenshot"
                      className="block max-h-[360px] w-full bg-sunk object-contain"
                    />
                  </a>
                </div>
              )}

              <div className="text-[11.5px] text-fg-3">Last updated {fmt(openReport.updatedAt)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BugTrackerPage;
