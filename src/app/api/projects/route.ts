import { desc, eq } from "drizzle-orm";

import { error, isUniqueViolation, json, projectToDict } from "@/lib/api";
import { tryDecodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  // Left-join users so the list can show a real "Created By" name — created_by
  // on the project row is just a user id, not a display name.
  const rows = await db
    .select({ project: projects, createdByName: users.name })
    .from(projects)
    .leftJoin(users, eq(projects.createdBy, users.id))
    .orderBy(desc(projects.createdAt));

  return json(rows.map((r) => projectToDict(r.project, r.createdByName)));
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const name = body.name;
  if (!name) {
    return error("'name' is required", 400);
  }

  // Enquiry no. (stored as project_code — column kept for compatibility) is
  // now user-supplied and required on create, replacing the earlier auto-
  // generated PRJ-NNN scheme. Uniqueness stays enforced by the DB constraint;
  // a duplicate falls through to the catch below and returns 409.
  const projectCode = String(body.project_code ?? body.projectCode ?? "").trim();
  if (!projectCode) {
    return error("'project_code' (Enquiry no.) is required", 400);
  }

  // Derived from the verified session cookie, not client input — a client
  // could otherwise attribute a project to any arbitrary user id.
  const createdBy = tryDecodeToken(req)?.sub ?? null;

  let project: typeof projects.$inferSelect;
  try {
    [project] = await db
      .insert(projects)
      .values({
        projectCode,
        name: String(name),
        customerName: (body.customer as string) ?? null,
        industry: (body.industry as string) ?? null,
        remarks: (body.remarks as string) ?? null,
        clientCode: (body.clientCode as string) ?? "Pending",
        // New projects start "Pending" — flips to "In Progress" once General
        // Information is saved, "Completed" once the final report is generated.
        status: (body.status as string) ?? "Pending",
        createdBy,
      })
      .returning();
  } catch (e) {
    // unique_violation on project_code (the DB constraint enforces Enquiry-no.
    // uniqueness; the client sees a friendly 409 rather than a 500).
    if (isUniqueViolation(e)) {
      return error(`Enquiry no. "${projectCode}" already exists`, 409);
    }
    throw e;
  }

  let createdByName: string | null = null;
  if (createdBy) {
    const [creator] = await db.select({ name: users.name }).from(users).where(eq(users.id, createdBy)).limit(1);
    createdByName = creator?.name ?? null;
  }

  return json(projectToDict(project, createdByName), 201);
}
