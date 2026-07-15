import { asc, sql } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { db } from "@/lib/db";
import { mediaTypes } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function toDict(row: typeof mediaTypes.$inferSelect) {
  return { id: row.id, name: row.name, created_at: row.createdAt };
}

export async function GET() {
  const rows = await db.select().from(mediaTypes).orderBy(asc(mediaTypes.name));
  return json(rows.map(toDict));
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return error("'name' is required", 400);
  }

  // Case-insensitive existence check first, so adding "chemical" when
  // "Chemical" already exists returns the existing row instead of erroring
  // on the unique index.
  const [existing] = await db
    .select()
    .from(mediaTypes)
    .where(sql`lower(${mediaTypes.name}) = lower(${name})`)
    .limit(1);
  if (existing) {
    return json(toDict(existing));
  }

  const [created] = await db.insert(mediaTypes).values({ name }).returning();
  return json(toDict(created), 201);
}
