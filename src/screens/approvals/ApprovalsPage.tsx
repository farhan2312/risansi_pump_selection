"use client";

import { useCallback, useEffect, useState } from "react";

import "./ApprovalsPage.css";
import "../../components/pump-selection/approval/ApprovalStep.css";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import {
  approvalStatusTone,
  type ApprovalInbox,
  type ApprovalInboxView,
} from "../../lib/approval";
import { listApprovalInbox } from "../../services/approvalService";
import ApprovalReviewModal from "./ApprovalReviewModal";

const VIEWS: { key: ApprovalInboxView; label: string }[] = [
  { key: "awaiting", label: "Awaiting decision" },
  { key: "decided", label: "Decided" },
  { key: "all", label: "All" },
];

const fmtWhen = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
};

/**
 * Selection head's inbox: every tag with steps sent for approval. Opening one
 * shows the review popup, where each step is approved or rejected. An email
 * link (?tag=<id>) opens that tag's popup straight away.
 */
const ApprovalsPage = () => {
  const [view, setView] = useState<ApprovalInboxView>("awaiting");
  const [inbox, setInbox] = useState<ApprovalInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTag, setOpenTag] = useState<string | null>(null);

  const load = useCallback(async (v: ApprovalInboxView, quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      setInbox(await listApprovalInbox(v));
    } catch {
      setError("Couldn't load approval requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(view);
  }, [view, load]);

  // Deep link from the request email. Read from window rather than
  // useSearchParams (which would need a Suspense boundary), then drop it so
  // closing the popup and refreshing doesn't reopen it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tag = params.get("tag");
    if (!tag) return;
    setOpenTag(tag);
    params.delete("tag");
    const q = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
  }, []);

  const items = inbox?.items ?? [];

  return (
    <div className="apv-page">
      <div className="apv-page-head">
        <h1>Approvals</h1>
        <p>Steps engineers have sent for your approval. Open a request to review each step and decide.</p>
      </div>

      <div className="apv-tabs" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            className={`apv-tab${view === v.key ? " is-active" : ""}`}
            onClick={() => setView(v.key)}
          >
            {v.label}
            {inbox && <span className="apv-tab-count">{inbox.counts[v.key]}</span>}
          </button>
        ))}
      </div>

      <div className="apv-list-panel">
        {loading && (
          <div style={{ padding: 16 }}>
            <SkeletonRows rows={4} cols={4} />
          </div>
        )}

        {!loading && error && <p className="apv-banner bad">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            compact
            title={view === "awaiting" ? "Nothing waiting for your approval" : "No requests here yet"}
            description={
              view === "awaiting"
                ? "When an engineer sends steps for approval, they appear here and you get an email."
                : "Requests appear here once engineers send steps for approval."
            }
          />
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="apv-list">
            {items.map((item) => (
              <li key={item.tagId}>
                <button type="button" className="apv-row" onClick={() => setOpenTag(item.tagId)}>
                  <span className="apv-row-main">
                    <span className="apv-row-title">
                      {item.enquiryCode} · {item.tagName}
                      {item.awaiting > 0 && (
                        <span className="apv-row-badge">{item.awaiting} to decide</span>
                      )}
                    </span>
                    <span className="apv-row-sub">
                      {[item.customerName, item.pumpModel].filter(Boolean).join(" · ") || item.projectName}
                    </span>
                    <span className="apv-row-steps">
                      {item.steps.map((s) => (
                        <span
                          key={s.step}
                          className={`approval-pill ${approvalStatusTone(s.status)}`}
                          title={`${s.label}: ${s.status}`}
                        >
                          {s.step}. {s.label}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="apv-row-meta">
                    <span>{item.sentByName ?? "—"}</span>
                    <span className="apv-row-when">{fmtWhen(item.sentAt)}</span>
                    <span className="apv-row-open">{item.awaiting > 0 ? "Review" : "View"} →</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {openTag && (
        <ApprovalReviewModal
          tagId={openTag}
          onClose={() => setOpenTag(null)}
          onDecided={() => void load(view, true)}
        />
      )}
    </div>
  );
};

export default ApprovalsPage;
