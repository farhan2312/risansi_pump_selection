import { asc, eq } from "drizzle-orm";

import { error, json, userToDict } from "@/lib/api";
import { AuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const status = new URL(req.url).searchParams.get("status");
  const rows = status
    ? await db.select().from(users).where(eq(users.status, status)).orderBy(asc(users.createdAt))
    : await db.select().from(users).orderBy(asc(users.createdAt));

  return json(rows.map(userToDict));
}
