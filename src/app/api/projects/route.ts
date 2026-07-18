import { desc, eq, sql } from "drizzle-orm";

import { error, json, projectToDict } from "@/lib/api";
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

  // Derived from the verified session cookie, not client input — a client
  // could otherwise attribute a project to any arbitrary user id.
  const createdBy = tryDecodeToken(req)?.sub ?? null;

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(projects);
  const [project] = await db
    .insert(projects)
    .values({
      projectCode: `PRJ-${String(count + 1).padStart(3, "0")}`,
      name: String(name),
      customerName: (body.customer as string) ?? null,
      industry: (body.industry as string) ?? null,
      remarks: (body.remarks as string) ?? null,
      clientCode: (body.clientCode as string) ?? "Pending",
      status: (body.status as string) ?? "In Progress",
      createdBy,
    })
    .returning();

  let createdByName: string | null = null;
  if (createdBy) {
    const [creator] = await db.select({ name: users.name }).from(users).where(eq(users.id, createdBy)).limit(1);
    createdByName = creator?.name ?? null;
  }

  return json(projectToDict(project, createdByName), 201);
}
