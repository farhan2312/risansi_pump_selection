"use client";

import { useState } from "react";

import "./GeneralInformationStep.css";
import "./approval/ApprovalStep.css";
import Stepper from "./Stepper";
import { actions, btnGhost, btnPrimary } from "./formStyles";
import { useApproval } from "./approval/ApprovalContext";
import {
  APPROVABLE_STEPS,
  APPROVAL_STEP_LABELS,
  DEFAULT_APPROVAL_STATUS,
  approvalStatusTone,
} from "../../lib/approval";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  onStepClick?: (step: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
};

const formatSentAt = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

/**
 * Step 8 — Approval. Collects every step ticked for approval on its own header
 * and sends them together. Steps are ticked on the step itself, not here, so
 * this page is a review-and-send screen rather than another place to choose.
 */
const ApprovalStep = ({ onNext, onPrevious, onStepClick, formData }: Props) => {
  const approval = useApproval();
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);

  const selectedSteps = APPROVABLE_STEPS.filter((s) => approval?.selected(s));
  // Only Pending rows move on send; anything already sent stays as it is.
  const pendingCount = selectedSteps.filter(
    (s) => (approval?.statusOf(s) ?? DEFAULT_APPROVAL_STATUS) === DEFAULT_APPROVAL_STATUS,
  ).length;

  const handleSend = async () => {
    if (!approval || sending || pendingCount === 0) return;
    setSending(true);
    setSentCount(null);
    try {
      setSentCount(await approval.send());
    } catch {
      // The context stores the message; the banner below renders it.
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="step-container">
      <Stepper currentStep={8} maxStep={formData.wizardMaxStep} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Approval</h2>
        <p>
          Steps ticked for approval on their own page are listed here. Review
          them and send them all at once.
        </p>

        {!approval?.tagId && (
          <p className="approval-empty">
            No tag is open, so there is nothing to send for approval.
          </p>
        )}

        {approval?.tagId && !approval.loaded && (
          <p className="approval-empty">Loading approval selections…</p>
        )}

        {approval?.tagId && approval.loaded && selectedSteps.length === 0 && (
          <p className="approval-empty">
            No steps are selected for approval yet. Go back to any step and tick{" "}
            <strong>Select for approval</strong> in its header.
          </p>
        )}

        {approval?.tagId && approval.loaded && selectedSteps.length > 0 && (
          <div className="approval-table-wrap">
            <table className="approval-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Status</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {selectedSteps.map((s) => {
                  const status = approval.statusOf(s);
                  return (
                    <tr key={s}>
                      <td>
                        <button
                          type="button"
                          className="approval-step-link"
                          onClick={() => onStepClick?.(s)}
                          title={`Go to ${APPROVAL_STEP_LABELS[s]}`}
                        >
                          {s}. {APPROVAL_STEP_LABELS[s]}
                        </button>
                      </td>
                      <td>
                        <span className={`approval-pill ${approvalStatusTone(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="mono">
                        {formatSentAt(approval.approvals[s]?.sentAt ?? null)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {approval?.error && <div className="approval-banner bad">{approval.error}</div>}

        {sentCount !== null && !approval?.error && (
          <div className="approval-banner ok">
            Sent {sentCount} step{sentCount === 1 ? "" : "s"} for approval.
          </div>
        )}

        {selectedSteps.length > 0 && pendingCount === 0 && sentCount === null && (
          <div className="approval-banner ok">
            Everything selected has already been sent for approval.
          </div>
        )}

        <div className="approval-send-row">
          <button
            type="button"
            className={btnPrimary}
            onClick={() => void handleSend()}
            disabled={sending || pendingCount === 0}
            title={
              pendingCount === 0
                ? "Nothing new to send — tick a step for approval first."
                : undefined
            }
          >
            {sending
              ? "Sending…"
              : `Send Approval${pendingCount ? ` (${pendingCount})` : ""}`}
          </button>
        </div>

        <div className={actions}>
          <button className={btnGhost} onClick={onPrevious}>
            Previous
          </button>
          <button className={btnPrimary} onClick={onNext}>
            Get Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalStep;
