import { and, desc, eq } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { bugReportSelection } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// The reporter's own status-change notifications for the top-bar bell — every
// report THEY filed whose status has changed since they last viewed it
// (reporterUnread). Any logged-in user; scoped to their own reports only
// (there's no admin-wide notification feed here — that's the Bug Tracker
// page, system_admin only).
export async function GET(req: Request) {
  let claims;
  try {
    claims = decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const rows = await db
    .select({
      id: bugReportSelection.id,
      title: bugReportSelection.title,
      status: bugReportSelection.status,
      updatedAt: bugReportSelection.updatedAt,
    })
    .from(bugReportSelection)
    .where(
      and(
        eq(bugReportSelection.reportedBy, claims.sub),
        eq(bugReportSelection.reporterUnread, true),
      ),
    )
    .orderBy(desc(bugReportSelection.updatedAt));

  return json({ count: rows.length, items: rows });
}
