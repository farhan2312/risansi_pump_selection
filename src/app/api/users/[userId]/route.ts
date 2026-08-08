import { eq } from "drizzle-orm";

import { error, json, userToDict } from "@/lib/api";
import { AuthError, requireSystemAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES = new Set(["user", "admin", "system_admin"]);
// "pending" is deliberately not settable via PATCH — a request only ever
// reaches "pending" through signup/resubmission (POST /api/access-requests).
const VALID_STATUSES = new Set(["active", "rejected", "deactivated"]);

// System-admin only, everything here — reviewing/editing users is explicitly
// excluded from the plain "admin" role per the 3-role spec.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  let claims;
  try {
    claims = requireSystemAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { userId } = await params;
  if (!UUID_RE.test(userId)) {
    return error("Invalid user id", 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return error("User not found", 404);
  }

  const patch: Partial<typeof users.$inferInsert> = {};

  if ("name" in body) {
    const n = String(body.name ?? "").trim();
    if (!n) return error("'name' can't be empty", 400);
    patch.name = n;
  }

  if ("role" in body) {
    const role = String(body.role ?? "");
    if (!VALID_ROLES.has(role)) {
      return error("'role' must be one of: user, admin, system_admin", 400);
    }
    // A system admin can't demote themselves — that could leave the app
    // with zero system admins able to undo the change.
    if (user.id === claims.sub && role !== "system_admin") {
      return error("You can't change your own role away from system_admin.", 400);
    }
    patch.role = role;
  }

  if ("status" in body) {
    const status = String(body.status ?? "");
    if (!VALID_STATUSES.has(status)) {
      return error("'status' must be one of: active, rejected, deactivated", 400);
    }
    if (user.id === claims.sub && status !== "active") {
      return error("You can't deactivate or reject your own account.", 400);
    }
    patch.status = status;
    // Reviewing a still-pending request (the original approve/reject flow)
    // stamps who reviewed it; editing an already-decided user's status
    // later (e.g. deactivating an active account) doesn't overwrite that
    // original review record.
    if (user.status === "pending") {
      patch.reviewedBy = claims.sub;
      patch.reviewedAt = new Date();
    }
  }

  if (Object.keys(patch).length === 0) {
    return error("No editable fields provided", 400);
  }

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, user.id))
    .returning();

  return json(userToDict(updated));
}

// System-admin only. Permanently removes a user row — used for cleaning up
// rejected requests or accounts created by mistake. A system admin can't
// delete their own account (would risk locking everyone out if they were
// the only one).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  let claims;
  try {
    claims = requireSystemAdmin(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const { userId } = await params;
  if (!UUID_RE.test(userId)) {
    return error("Invalid user id", 400);
  }
  if (userId === claims.sub) {
    return error("You can't delete your own account.", 400);
  }

  const [deleted] = await db.delete(users).where(eq(users.id, userId)).returning();
  if (!deleted) {
    return error("User not found", 404);
  }

  return json({ id: deleted.id, deleted: true });
}
