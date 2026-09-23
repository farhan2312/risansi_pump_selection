import { asc, sql } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, decodeToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { endConnectionMaster } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// End Connection options for the Fluid step's dropdown.
//
//   GET            the list
//   POST {value}   add a value typed into "Other", then return the updated
//                  list. A repeat of an existing value (any case) just returns
//                  the list - it is not duplicated.
//
// Any signed-in user: adding a missing standard is part of filling the wizard,
// not an admin job. The list is small and shared, so a new value shows up for
// everyone - the audit trail records who added what.

const MAX_LENGTH = 120;

async function list(): Promise<string[]> {
  const rows = await db
    .select({ value: endConnectionMaster.value })
    .from(endConnectionMaster)
    .orderBy(asc(endConnectionMaster.sortOrder), asc(endConnectionMaster.value));
  return rows.map((r) => r.value);
}

export async function GET(req: Request) {
  try {
    decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }
  return json(await list());
}

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

  const value = String(body.value ?? "").trim();
  if (!value) return error("'value' is required", 400);
  if (value.length > MAX_LENGTH) return error(`'value' must be ${MAX_LENGTH} characters or fewer`, 400);

  // Case-insensitive match first, so "BSP Type" doesn't become a second "BSP type".
  const [existing] = await db
    .select({ value: endConnectionMaster.value })
    .from(endConnectionMaster)
    .where(sql`lower(${endConnectionMaster.value}) = lower(${value})`)
    .limit(1);

  if (!existing) {
    await db.insert(endConnectionMaster).values({ value, createdBy: claims.sub });
    await logAudit(req, {
      action: "end_connection.add",
      entity: "end_connection_master",
      detail: `Added End Connection "${value}"`,
    });
  }

  return json({ value: existing?.value ?? value, options: await list() });
}
