"use client";

import "./StepApprovalToggle.css";
import { isApprovableStep } from "../../../lib/approval";
import { useApproval } from "./ApprovalContext";

/**
 * "Send for approval" tick for one wizard step, sitting at the top right of
 * that step's header banner. Ticking it puts the step on the Approval step's
 * list; the Approval step is where they are all sent together.
 *
 * Renders nothing when there's no tag open (nothing to save against) or when
 * the step isn't approvable — so it can be dropped into any step header
 * unconditionally.
 */
const StepApprovalToggle = ({ step }: { step: number }) => {
  const approval = useApproval();
  if (!approval || !approval.tagId || !isApprovableStep(step)) return null;

  const checked = approval.selected(step);
  const status = approval.statusOf(step);
  // Once sent, the tick is locked: un-ticking would silently withdraw a step
  // an approver has already been asked to look at.
  const sent = checked && status !== "Pending";

  return (
    <label
      className={`step-approval${sent ? " is-sent" : ""}`}
      title={
        sent
          ? `Already sent for approval (${status}) — it can't be withdrawn here.`
          : "Tick to send this step for approval. Review and send them all on the Approval step."
      }
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={sent || !approval.loaded}
        onChange={(e) => void approval.toggle(step, e.target.checked)}
      />
      <span className="step-approval-text">
        {sent ? status : "Select for approval"}
      </span>
    </label>
  );
};

export default StepApprovalToggle;
