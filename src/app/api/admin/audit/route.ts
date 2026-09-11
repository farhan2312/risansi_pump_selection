import { and, desc, gte, sql } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, requireSystemAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import {
  activityByUser,
  latestRole,
  isAuditRange,
  rangeStart,
  type AuditRange,
} from "@/lib/audit-stats";

export const dynamic = "force-dynamic";

// Read side of the audit trail (system_admin only). One request returns the
// four header counters plus the rows for whichever tab is being shown, so the
// page doesn't fan out into several calls per filter change.
//
// The counters are always "last 24h" regardless of the tab's own range filter
// — they answer "what is happening right now", which is a different question
// from the table underneath.



const MAX_ROWS = 500;

export async function GET(req: Request) {
  try {
    requireSystemAdmin(req);
  } catch (err) {
    if (err instanceof AuthError) return error(err.message, err.statusCode);
    throw err;
  }

  const url = new URL(req.url);
  const rangeRaw = url.searchParams.get("range") ?? "7d";
  const range: AuditRange = isAuditRange(rangeRaw) ? rangeRaw : "7d";
  const tab = url.searchParams.get("tab") ?? "usage";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const since = rangeStart(range);
  const scope = since ? gte(auditLog.createdAt, since) : undefined;
  const day = new Date(Date.now() - 86400_000);

  // --- Header counters: always the last 24 hours ---
  const [counts] = await db
    .select({
      logins: sql<number>`count(*) filter (where ${auditLog.eventType} = 'login')::int`,
      failed: sql<number>`count(*) filter (where ${auditLog.eventType} = 'login_failed')::int`,
      activeUsers: sql<number>`count(distinct ${auditLog.userEmail})::int`,
      actions: sql<number>`count(*) filter (where ${auditLog.eventType} = 'action')::int`,
    })
    .from(auditLog)
    .where(gte(auditLog.createdAt, day));

  const summary = {
    logins24h: counts?.logins ?? 0,
    failed24h: counts?.failed ?? 0,
    activeUsers24h: counts?.activeUsers ?? 0,
    actions24h: counts?.actions ?? 0,
  };

  // --- Usage by user: one row per person in range ---
  if (tab === "usage") {
    const rows = await db
      .select({
        email: auditLog.userEmail,
        role: latestRole,
        actions: sql<number>`count(*) filter (where ${auditLog.eventType} = 'action')::int`,
        sessions: sql<number>`count(*) filter (where ${auditLog.eventType} = 'login')::int`,
        lastActive: sql<string>`max(${auditLog.createdAt})`,
      })
      .from(auditLog)
      .where(scope)
      .groupBy(auditLog.userEmail)
      .orderBy(desc(sql`max(${auditLog.createdAt})`));

    // Active time comes from the gaps between each user's events - see
    // lib/audit-stats.ts for why it is not login-to-logout.
    const activity = await activityByUser(since);

    const filtered = rows
      .filter((r) => r.email)
      .map((r) => ({
        ...r,
        activeSeconds: activity.get(r.email as string)?.activeSeconds ?? 0,
      }))
      .filter(
        (r) =>
          !q ||
          (r.email ?? "").toLowerCase().includes(q) ||
          (r.role ?? "").toLowerCase().includes(q),
      );
    return json({ summary, rows: filtered });
  }

  // --- Row-level tabs ---
  // activity  : everything the user did (excludes sign-in events)
  // logins    : sign-in / sign-out / failed attempts
  // access    : role, status and account changes — this app's equivalent of
  //             the "ownership changes" view (who was granted or lost access)
  const tabFilter =
    tab === "logins"
      ? sql`${auditLog.eventType} in ('login', 'login_failed', 'logout')`
      : tab === "access"
        ? sql`${auditLog.action} like 'user.%'`
        : sql`${auditLog.eventType} = 'action'`;

  const searchFilter = q
    ? sql`(lower(coalesce(${auditLog.userEmail}, '')) like ${"%" + q + "%"}
        or lower(coalesce(${auditLog.action}, '')) like ${"%" + q + "%"}
        or lower(coalesce(${auditLog.detail}, '')) like ${"%" + q + "%"})`
    : undefined;

  const rows = await db
    .select({
      id: auditLog.id,
      email: auditLog.userEmail,
      role: auditLog.userRole,
      eventType: auditLog.eventType,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      detail: auditLog.detail,
      ip: auditLog.ip,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(scope ? and(scope, tabFilter, searchFilter) : and(tabFilter, searchFilter))
    .orderBy(desc(auditLog.createdAt))
    .limit(MAX_ROWS);

  return json({ summary, rows });
}
