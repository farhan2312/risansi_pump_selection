import { desc, sql } from "drizzle-orm";

import { error, json, projectToDict } from "@/lib/api";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  return json(rows.map(projectToDict));
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
    })
    .returning();

  return json(projectToDict(project), 201);
}
