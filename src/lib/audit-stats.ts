/**
 * Server-side audit-log statistics shared by the Audit Log page
 * (/api/admin/audit) and its PDF report (/api/admin/audit/report), so both
 * compute "active time" the same way.
 *
 * ACTIVE TIME is estimated from activity, not from login/logout. Logout is
 * almost never recorded — people close the tab, and sessions outlive the
 * working day (47 logins vs 1 logout when this was built) — so login→logout
 * would be meaningless. Instead, each user's events are ordered in time and
 * the gap between consecutive events is summed, counting only gaps no longer
 * than IDLE_CUTOFF_SECONDS. A longer gap means they walked away, so it is
 * idle rather than active and starts a new stretch of activity.
 *
 * The 15-minute cutoff comes from the data: gaps between one user's events
 * cluster heavily under a minute and fall away sharply past 15 minutes.
 *
 * It is a conservative estimate: time spent before the first event of a
 * stretch (reading, filling in a form before saving) is not visible to the
 * audit trail, and a lone event contributes nothing.
 */
import { sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

export const IDLE_CUTOFF_SECONDS = 15 * 60;

export type AuditRange = "today" | "7d" | "30d" | "all";

export const AUDIT_RANGES: readonly AuditRange[] = ["today", "7d", "30d", "all"];

export const isAuditRange = (v: string): v is AuditRange =>
  (AUDIT_RANGES as readonly string[]).includes(v);

/** Start of the window for a range key, or null for "all". */
export function rangeStart(range: AuditRange): Date | null {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "7d") return new Date(now.getTime() - 7 * 86400_000);
  if (range === "30d") return new Date(now.getTime() - 30 * 86400_000);
  return null;
}

const sinceClause = (since: Date | null): SQL =>
  since ? sql`and ${auditLog.createdAt} >= ${since}` : sql``;

/**
 * Aggregate: a user's MOST RECENT recorded role within the grouped rows.
 *
 * Replaces `max(user_role)`, which compares the strings alphabetically - so a
 * user promoted or demoted mid-range got whichever of "admin" / "user" /
 * "system_admin" sorts last, not the role they actually ended up with. Rows
 * with no role (failed sign-ins) are skipped rather than winning as "latest".
 */
export const latestRole = sql<string | null>`
  (array_agg(${auditLog.userRole} order by ${auditLog.createdAt} desc)
     filter (where ${auditLog.userRole} is not null))[1]`;

/** Per-user activity over the window: active seconds plus how many separate
 *  stretches of activity (a gap past the idle cutoff starts a new one). */
export async function activityByUser(
  since: Date | null,
): Promise<Map<string, { activeSeconds: number; stretches: number }>> {
  const res = await db.execute<{ email: string; active: number; stretches: number }>(sql`
    with ev as (
      select ${auditLog.userEmail} as email,
             extract(epoch from ${auditLog.createdAt} - lag(${auditLog.createdAt})
               over (partition by ${auditLog.userEmail} order by ${auditLog.createdAt})) as gap
      from ${auditLog}
      where ${auditLog.userEmail} is not null ${sinceClause(since)}
    )
    select email,
           coalesce(sum(gap) filter (where gap <= ${IDLE_CUTOFF_SECONDS}), 0)::float8 as active,
           (count(*) filter (where gap is null or gap > ${IDLE_CUTOFF_SECONDS}))::int as stretches
    from ev
    group by email
  `);
  const out = new Map<string, { activeSeconds: number; stretches: number }>();
  for (const r of res.rows) {
    out.set(r.email, {
      activeSeconds: Math.round(Number(r.active) || 0),
      stretches: Number(r.stretches) || 0,
    });
  }
  return out;
}
