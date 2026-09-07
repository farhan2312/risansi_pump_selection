import { and, asc, eq, inArray } from "drizzle-orm";

import { error, json } from "@/lib/api";
import {
  APPROVABLE_STEPS,
  DEFAULT_APPROVAL_STATUS,
  SENT_APPROVAL_STATUS,
  isApprovableStep,
  type ApprovalStatus,
} from "@/lib/approval";
import { AuthError, decodeToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { enquiryTags, stepApproval } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Per-step approval for one tag's wizard.
//
//   GET  ?tagId=…            every approval row for the tag
//   PUT  {tagId, step, selected}   tick/untick one step
//   POST {tagId}             send every ticked, still-Pending step
//
// Separate from /api/wizard-input/[table] because those tables hold exactly
// one row per tag, while this one holds up to seven (one per approvable step).
// Any authenticated user runs the wizard, so these gate on decodeToken.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = typeof stepApproval.$inferSelect;

const toDict = (r: Row) => ({
  step: r.step,
  selected: r.selected,
  status: r.status as ApprovalStatus,
  sentAt: r.sentAt ? r.sentAt.toISOString() : null,
  decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  remarks: r.remarks,
});

/** Resolve + validate the tag, so a caller can't write approvals against a
 * tag id that doesn't exist (the FK would reject it anyway, with a 500). */
async function loadTag(tagId: string) {
  const [tag] = await db
    .select()
    .from(enquiryTags)
    .where(eq(enquiryTags.id, tagId))
    .limit(1);
  return tag ?? null;
}

export async function GET(req: Request) {
  try {
    decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const tagId = new URL(req.url).searchParams.get("tagId");
  if (!tagId || !UUID_RE.test(tagId)) {
    return error("'tagId' query param is required and must be a uuid", 400);
  }

  const rows = await db
    .select()
    .from(stepApproval)
    .where(eq(stepApproval.tagId, tagId))
    .orderBy(asc(stepApproval.step));

  return json(rows.map(toDict));
}

export async function PUT(req: Request) {
  try {
    decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const tagId = String(body.tagId ?? "");
  if (!UUID_RE.test(tagId)) return error("'tagId' is required and must be a uuid", 400);

  const step = Number(body.step);
  if (!Number.isInteger(step) || !isApprovableStep(step)) {
    return error(`'step' must be one of: ${APPROVABLE_STEPS.join(", ")}`, 400);
  }

  const selected = Boolean(body.selected);

  const tag = await loadTag(tagId);
  if (!tag) return error("Tag not found", 404);

  // Un-ticking resets the row to Pending as well as clearing the tick: the
  // step is no longer up for approval at all, so leaving "Awaiting Approval"
  // behind would misreport it on the Approval step if it were re-ticked.
  const [row] = await db
    .insert(stepApproval)
    .values({
      projectId: tag.projectId,
      tagId,
      step,
      selected,
      status: DEFAULT_APPROVAL_STATUS,
    })
    .onConflictDoUpdate({
      target: [stepApproval.tagId, stepApproval.step],
      set: selected
        ? { selected: true, updatedAt: new Date() }
        : {
            selected: false,
            status: DEFAULT_APPROVAL_STATUS,
            sentAt: null,
            sentBy: null,
            updatedAt: new Date(),
          },
    })
    .returning();

  await logAudit(req, {
    action: "approval.select",
    entity: "step_approval",
    entityId: row.id,
    detail: `${tag.name}: step ${step} ${selected ? "marked for" : "removed from"} approval`,
  });

  return json(toDict(row));
}

export async function POST(req: Request) {
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const tagId = String(body.tagId ?? "");
  if (!UUID_RE.test(tagId)) return error("'tagId' is required and must be a uuid", 400);

  const tag = await loadTag(tagId);
  if (!tag) return error("Tag not found", 404);

  const pending = await db
    .select()
    .from(stepApproval)
    .where(
      and(
        eq(stepApproval.tagId, tagId),
        eq(stepApproval.selected, true),
        eq(stepApproval.status, DEFAULT_APPROVAL_STATUS),
      ),
    );

  if (pending.length === 0) {
    return error("No steps are selected and pending approval.", 400);
  }

  // Only the Pending ones move. A step already Awaiting Approval (or decided)
  // is left alone, so re-sending can't reset an approver's decision or
  // overwrite the original sent-at stamp.
  await db
    .update(stepApproval)
    .set({
      status: SENT_APPROVAL_STATUS,
      sentAt: new Date(),
      sentBy: UUID_RE.test(claims.sub) ? claims.sub : null,
      updatedAt: new Date(),
    })
    .where(
      inArray(
        stepApproval.id,
        pending.map((r) => r.id),
      ),
    );

  // NOTE: no email is sent — per product decision the button records the
  // request only, and notifying the approver comes later. When it does, it
  // hooks in HERE, after the rows are committed, so a mail failure can never
  // leave the steps un-sent.

  await logAudit(req, {
    action: "approval.send",
    entity: "step_approval",
    entityId: tagId,
    detail: `${tag.name}: sent ${pending.length} step(s) for approval — ${pending
      .map((r) => r.step)
      .sort((a, b) => a - b)
      .join(", ")}`,
  });

  const rows = await db
    .select()
    .from(stepApproval)
    .where(eq(stepApproval.tagId, tagId))
    .orderBy(asc(stepApproval.step));

  return json({ sent: pending.length, approvals: rows.map(toDict) });
}
