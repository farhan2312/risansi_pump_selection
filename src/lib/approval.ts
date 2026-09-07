/**
 * Per-step approval: which wizard steps can be put up for approval, what the
 * statuses are, and how they read on screen.
 *
 * Shared by the client (the toggle on each step header, the Approval step's
 * table) and the server (/api/step-approvals), so the two can never disagree
 * about which step numbers are valid or which statuses exist.
 */

/** Wizard steps that can be sent for approval, in wizard order.
 *
 * Steps 1-7 only. Step 8 is the Approval step itself — it cannot approve
 * itself — and step 9 is the generated summary, which is output rather than a
 * decision anyone signs off. */
export const APPROVABLE_STEPS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Step number -> the label used on the Approval step and in the audit trail.
 * Matches the Stepper's own labels, spelled out where the stepper abbreviates
 * (the stepper has a few pixels per step; this table does not). */
export const APPROVAL_STEP_LABELS: Record<number, string> = {
  1: "General Information",
  2: "Fluid Properties",
  3: "Specifications",
  4: "MOC & Elastomer",
  5: "Sealing Details",
  6: "Motor Rating",
  7: "Drive Details",
};

export const isApprovableStep = (step: number): boolean =>
  (APPROVABLE_STEPS as readonly number[]).includes(step);

/** Lifecycle of one step's approval.
 *
 * Pending           - ticked for approval, not sent yet (the default).
 * Awaiting Approval - sent; the approver has not decided.
 * Approved/Rejected - the approver's decision. Nothing sets these yet: there
 *                     is no approver screen, and sending is not wired to email
 *                     (deliberate - "no email integration, we will do later").
 *                     They exist so a decision can be recorded without another
 *                     migration.
 */
export const APPROVAL_STATUSES = [
  "Pending",
  "Awaiting Approval",
  "Approved",
  "Rejected",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const isApprovalStatus = (value: string): value is ApprovalStatus =>
  (APPROVAL_STATUSES as readonly string[]).includes(value);

/** The status a freshly-ticked step starts in. */
export const DEFAULT_APPROVAL_STATUS: ApprovalStatus = "Pending";

/** What "Send Approval" moves a Pending step to. */
export const SENT_APPROVAL_STATUS: ApprovalStatus = "Awaiting Approval";

/** One step's approval state as it travels over the wire. */
export type StepApproval = {
  step: number;
  selected: boolean;
  status: ApprovalStatus;
  sentAt: string | null;
  decidedAt: string | null;
  remarks: string | null;
};

/** CSS modifier for a status pill — keeps the colour mapping in one place
 * rather than repeated in each component that renders a status. */
export const approvalStatusTone = (status: ApprovalStatus): string => {
  if (status === "Approved") return "ok";
  if (status === "Rejected") return "bad";
  if (status === "Awaiting Approval") return "sent";
  return "pending";
};
