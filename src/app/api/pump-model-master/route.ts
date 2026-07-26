import { asc } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { pumpModelMaster } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Admin-only master-data listing. The page lives under /admin/* (gated by
// middleware), but this API route isn't, so it self-gates with requireAdmin.
export async function GET(req: Request) {
  try {
    requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const rows = await db
    .select()
    .from(pumpModelMaster)
    .orderBy(asc(pumpModelMaster.model), asc(pumpModelMaster.headMwc));

  return json(rows);
}
