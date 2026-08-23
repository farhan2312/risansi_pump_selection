import { eq } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { motorMaster } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Optional numeric columns (pg NUMERIC — stored/returned as strings).
const NUMERIC_FIELDS = ["motorKw", "motorHp", "lpPrice", "finalPrice"] as const;
const TEXT_FIELDS = ["motorType", "mounting", "frameSize"] as const;

function numOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isNaN(n) ? null : String(n);
}

// motor_rpm is an integer column — Drizzle wants a real number here.
function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function textOrNull(v: unknown): string | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  return String(v).trim();
}

function guardAdmin(req: Request): Response | null {
  try {
    requireAdmin(req);
    return null;
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = guardAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  if (!UUID_RE.test(id)) return error("Invalid row id", 400);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const patch: Partial<typeof motorMaster.$inferInsert> = {};

  // brand + motorKw are the required identifiers — reject blanking them.
  if ("brand" in body) {
    const b = String(body.brand ?? "").trim();
    if (!b) return error("'brand' can't be empty", 400);
    patch.brand = b;
  }
  if ("motorKw" in body) {
    const kw = numOrNull(body.motorKw);
    if (kw === null) return error("'motorKw' is required and must be a number", 400);
    patch.motorKw = kw;
  }
  for (const f of NUMERIC_FIELDS) {
    if (f !== "motorKw" && f in body) patch[f] = numOrNull(body[f]);
  }
  if ("motorRpm" in body) patch.motorRpm = intOrNull(body.motorRpm);
  for (const f of TEXT_FIELDS) {
    if (f in body) patch[f] = textOrNull(body[f]);
  }

  if (Object.keys(patch).length === 0) {
    return error("No editable fields provided", 400);
  }

  const [updated] = await db
    .update(motorMaster)
    .set(patch)
    .where(eq(motorMaster.id, id))
    .returning();
  if (!updated) return error("Row not found", 404);

  return json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = guardAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  if (!UUID_RE.test(id)) return error("Invalid row id", 400);

  const [deleted] = await db
    .delete(motorMaster)
    .where(eq(motorMaster.id, id))
    .returning();
  if (!deleted) return error("Row not found", 404);

  return json({ id: deleted.id, deleted: true });
}
