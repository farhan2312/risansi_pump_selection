import { desc, eq } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, decodeToken, requireSystemAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bugReportSelection } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const TYPES = new Set(["bug", "feature"]);
const SEVERITIES = new Set(["Low", "Medium", "High", "Critical"]);

function textOrNull(v: unknown): string | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  return String(v).trim();
}

// GET is system_admin only (the Bug Tracker page) — reporters don't get a
// list view, only their own status-change notifications (see
// /api/bug-reports/notifications). Never returns the binary screenshot_data
// column; the tracker fetches that separately via [id]/screenshot when a row
// has one, same pattern as the MOC PDF blob route.
export async function GET(req: Request) {
  try {
    requireSystemAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const rows = await db
    .select({
      id: bugReportSelection.id,
      type: bugReportSelection.type,
      title: bugReportSelection.title,
      description: bugReportSelection.description,
      severity: bugReportSelection.severity,
      page: bugReportSelection.page,
      status: bugReportSelection.status,
      screenshotFileName: bugReportSelection.screenshotFileName,
      screenshotMimeType: bugReportSelection.screenshotMimeType,
      screenshotFileSize: bugReportSelection.screenshotFileSize,
      reportedBy: bugReportSelection.reportedBy,
      reportedByName: bugReportSelection.reportedByName,
      createdAt: bugReportSelection.createdAt,
      updatedAt: bugReportSelection.updatedAt,
    })
    .from(bugReportSelection)
    .orderBy(desc(bugReportSelection.createdAt));

  return json(rows);
}

// Any logged-in user can file a report — this is the "Report a Bug" button
// available everywhere in the top bar, not an admin-only action.
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

  const title = textOrNull(body.title);
  if (!title) return error("'title' is required", 400);

  const description = textOrNull(body.description);
  if (!description) return error("'description' (What happened?) is required", 400);

  const type = TYPES.has(String(body.type)) ? String(body.type) : "bug";
  const severity = SEVERITIES.has(String(body.severity)) ? String(body.severity) : "Medium";
  const page = textOrNull(body.page);

  // Screenshot arrives as a data URL (from <input type=file> or a clipboard
  // paste, both read client-side as base64) — decoded here into the bytea
  // column, same idea as the MOC PDF upload but inline in this JSON body
  // rather than a separate binary POST, since it's optional and small.
  let screenshotFileName: string | null = null;
  let screenshotMimeType: string | null = null;
  let screenshotFileSize: number | null = null;
  let screenshotData: Buffer | null = null;
  const dataUrl = body.screenshotDataUrl;
  if (typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (m) {
      screenshotMimeType = m[1];
      screenshotData = Buffer.from(m[2], "base64");
      screenshotFileSize = screenshotData.length;
      screenshotFileName = textOrNull(body.screenshotFileName) ?? "screenshot.png";
    }
  }

  const [created] = await db
    .insert(bugReportSelection)
    .values({
      type,
      title,
      description,
      severity,
      page,
      screenshotFileName,
      screenshotMimeType,
      screenshotFileSize,
      screenshotData,
      reportedBy: claims.sub,
      reportedByName: claims.name ?? claims.email ?? null,
    })
    .returning({
      id: bugReportSelection.id,
      type: bugReportSelection.type,
      title: bugReportSelection.title,
      description: bugReportSelection.description,
      severity: bugReportSelection.severity,
      page: bugReportSelection.page,
      status: bugReportSelection.status,
      createdAt: bugReportSelection.createdAt,
    });

  return json(created, 201);
}
