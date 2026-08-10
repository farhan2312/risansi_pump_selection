import { desc, eq, isNotNull } from "drizzle-orm";

import { json } from "@/lib/api";
import { db } from "@/lib/db";
import { projects, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// One row per project that has a saved final Selection Summary report
// (projects.reportDocument — set when the user clicks "Confirm Pump
// Selection" on the last wizard step). Storing it on the project's own row
// makes "one project, one report" automatic — there's nowhere else for a
// second one to live. No auth gate here — same convention as the other
// project routes; the /selection-summary page itself is already gated by
// middleware.
export async function GET() {
  const rows = await db
    .select({
      projectId: projects.id,
      projectCode: projects.projectCode,
      projectName: projects.name,
      // Client code, not customer — customerName isn't collected at
      // creation (only clientCode is, via the Create Project form), so it's
      // almost always empty. clientCode is what's actually filled in.
      clientCode: projects.clientCode,
      status: projects.status,
      createdByName: users.name,
      documentFilename: projects.reportFilename,
      documentGeneratedAt: projects.reportGeneratedAt,
    })
    .from(projects)
    .leftJoin(users, eq(projects.createdBy, users.id))
    .where(isNotNull(projects.reportDocument))
    .orderBy(desc(projects.reportGeneratedAt));

  return json(
    rows.map((r) => ({
      project_id: r.projectId,
      project_code: r.projectCode,
      project_name: r.projectName,
      client_code: r.clientCode,
      status: r.status,
      created_by_name: r.createdByName,
      document_filename: r.documentFilename,
      document_generated_at: r.documentGeneratedAt,
    })),
  );
}
