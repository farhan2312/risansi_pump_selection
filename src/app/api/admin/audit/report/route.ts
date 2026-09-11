import { and, desc, gte, sql, type SQL } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, requireSystemAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  activityByUser,
  latestRole,
  IDLE_CUTOFF_SECONDS,
  isAuditRange,
  rangeStart,
  type AuditRange,
} from "@/lib/audit-stats";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Everything the Audit Log PDF report needs, for ONE date range, in one call.
// System-admin only.
//
// Differs from /api/admin/audit on purpose:
//   - every section at once (the page only loads the tab in view);
//   - the headline figures are for the SELECTED range, not the page's fixed
//     "last 24h" counters - a report for 30 days should total 30 days;
//   - a higher row cap per section, and the report says when it was hit
//     rather than silently truncating.

const SECTION_CAP = 2000;

const eventColumns = {
  id: auditLog.id,
  email: auditLog.userEmail,
  role: auditLog.userRole,
  eventType: auditLog.eventType,
  action: auditLog.action,
  entity: auditLog.entity,
  detail: auditLog.detail,
  ip: auditLog.ip,
  createdAt: auditLog.createdAt,
};

export async function GET(req: Request) {
  try {
    requireSystemAdmin(req);
  } catch (err) {
    if (err instanceof AuthError) return error(err.message, err.statusCode);
    throw err;
  }

  const rangeRaw = new URL(req.url).searchParams.get("range") ?? "7d";
  const range: AuditRange = isAuditRange(rangeRaw) ? rangeRaw : "7d";
  const since = rangeStart(range);
  const scope = since ? gte(auditLog.createdAt, since) : undefined;
  const within = (extra: SQL) => (scope ? and(scope, extra) : extra);

  // --- Headline figures, for the selected range ---
  const [totals] = await db
    .select({
      events: sql<number>`count(*)::int`,
      logins: sql<number>`count(*) filter (where ${auditLog.eventType} = 'login')::int`,
      failed: sql<number>`count(*) filter (where ${auditLog.eventType} = 'login_failed')::int`,
      actions: sql<number>`count(*) filter (where ${auditLog.eventType} = 'action')::int`,
      activeUsers: sql<number>`count(distinct ${auditLog.userEmail})::int`,
      first: sql<string | null>`min(${auditLog.createdAt})`,
      last: sql<string | null>`max(${auditLog.createdAt})`,
    })
    .from(auditLog)
    .where(scope);

  // --- Usage by user, with active time ---
  const activity = await activityByUser(since);
  const usageRaw = await db
    .select({
      email: auditLog.userEmail,
      role: latestRole,
      actions: sql<number>`count(*) filter (where ${auditLog.eventType} = 'action')::int`,
      sessions: sql<number>`count(*) filter (where ${auditLog.eventType} = 'login')::int`,
      failed: sql<number>`count(*) filter (where ${auditLog.eventType} = 'login_failed')::int`,
      firstSeen: sql<string>`min(${auditLog.createdAt})`,
      lastActive: sql<string>`max(${auditLog.createdAt})`,
    })
    .from(auditLog)
    .where(scope)
    .groupBy(auditLog.userEmail)
    .orderBy(desc(sql`max(${auditLog.createdAt})`));

  const usage = usageRaw
    .filter((r) => r.email)
    .map((r) => ({
      ...r,
      activeSeconds: activity.get(r.email as string)?.activeSeconds ?? 0,
      stretches: activity.get(r.email as string)?.stretches ?? 0,
    }))
    // Most engaged first - that's the question a usage report is read for.
    .sort((a, b) => b.activeSeconds - a.activeSeconds);

  const totalActiveSeconds = usage.reduce((sum, u) => sum + u.activeSeconds, 0);

  // --- What was done, by action type ---
  const byAction = await db
    .select({
      action: auditLog.action,
      count: sql<number>`count(*)::int`,
      users: sql<number>`count(distinct ${auditLog.userEmail})::int`,
    })
    .from(auditLog)
    .where(within(sql`${auditLog.eventType} = 'action'`))
    .groupBy(auditLog.action)
    .orderBy(desc(sql`count(*)`));

  // --- Row-level sections (+1 so we can tell whether the cap was hit) ---
  const section = async (filter: SQL) => {
    const rows = await db
      .select(eventColumns)
      .from(auditLog)
      .where(within(filter))
      .orderBy(desc(auditLog.createdAt))
      .limit(SECTION_CAP + 1);
    return { rows: rows.slice(0, SECTION_CAP), truncated: rows.length > SECTION_CAP };
  };

  const [logins, access, activityEvents] = await Promise.all([
    section(sql`${auditLog.eventType} in ('login', 'login_failed', 'logout')`),
    section(sql`${auditLog.action} like 'user.%'`),
    section(sql`${auditLog.eventType} = 'action'`),
  ]);

  // Generating the report is itself worth recording - it exports the trail.
  await logAudit(req, {
    action: "audit.report",
    entity: "audit_log",
    detail: `Generated audit report (${range})`,
  });

  return json({
    range,
    since: since ? since.toISOString() : null,
    generatedAt: new Date().toISOString(),
    idleCutoffMinutes: IDLE_CUTOFF_SECONDS / 60,
    totals: {
      ...totals,
      totalActiveSeconds,
    },
    usage,
    byAction,
    logins,
    access,
    activity: activityEvents,
  });
}
