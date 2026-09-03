/**
 * Audit trail writer — feeds the system-admin Audit Log page.
 *
 * Design rules:
 *  - NEVER throws and never blocks the caller's response. Auditing is
 *    observability, not business logic: if the insert fails (DB blip, column
 *    drift) the user's action must still succeed. Every call is wrapped and
 *    failures are logged to the server console only.
 *  - Identity is denormalised onto the row (email + role as they were at the
 *    time), so the trail still reads correctly after a rename/re-role.
 *  - Append-only. Nothing in the app updates or deletes audit rows.
 */
import { db } from "./db";
import { auditLog } from "./db/schema";
import { tryDecodeToken } from "./auth";

/** login/logout are session events; `action` is everything else. */
export type AuditEventType = "login" | "login_failed" | "logout" | "action";

export interface AuditEntry {
  eventType?: AuditEventType;
  /** Dotted verb, e.g. "project.create", "wizard.save", "user.role_change". */
  action: string;
  entity?: string | null;
  entityId?: string | null;
  /** Short human-readable summary shown in the Activity feed. */
  detail?: string | null;
  /** Overrides the signed-in user — used by the login routes, where the actor
   * isn't authenticated yet (or the attempt failed). */
  actor?: { id?: string | null; email?: string | null; role?: string | null };
}

/** First hop in X-Forwarded-For, else the platform's own header. Best effort —
 * behind a proxy this is whatever that proxy reports. */
function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64) || null;
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? null;
}

/**
 * Records one audit row. Fire-and-forget from the caller's point of view —
 * await it if you want the row written before responding, or ignore the
 * promise; either way it cannot reject.
 */
export async function logAudit(req: Request, entry: AuditEntry): Promise<void> {
  try {
    // The signed-in user, when there is one. tryDecodeToken never throws.
    const claims = entry.actor ? null : tryDecodeToken(req);
    const actorId = entry.actor?.id ?? claims?.sub ?? null;
    const actorEmail = entry.actor?.email ?? claims?.email ?? null;
    const actorRole = entry.actor?.role ?? claims?.role ?? null;

    await db.insert(auditLog).values({
      userId: actorId && /^[0-9a-f-]{36}$/i.test(actorId) ? actorId : null,
      userEmail: actorEmail ? actorEmail.slice(0, 255) : null,
      userRole: actorRole ? actorRole.slice(0, 30) : null,
      eventType: entry.eventType ?? "action",
      action: entry.action.slice(0, 80),
      entity: entry.entity ? entry.entity.slice(0, 80) : null,
      entityId: entry.entityId ? String(entry.entityId).slice(0, 120) : null,
      detail: entry.detail ?? null,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
  } catch (err) {
    // Deliberately swallowed — see the header comment.
    console.error("audit log write failed:", err instanceof Error ? err.message : err);
  }
}
