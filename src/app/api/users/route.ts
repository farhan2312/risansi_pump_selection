import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";

import { error, json, userToDict } from "@/lib/api";
import { AuthError, requireSystemAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set(["user", "admin", "system_admin"]);

// System-admin only — managing the full user list (not just pending
// requests) is explicitly excluded from the plain "admin" role, per the
// 3-role spec.
export async function GET(req: Request) {
  try {
    requireSystemAdmin(req);
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

/** Directly creates an already-active user — the "+ Add User" action on the
 * Users & Access page. Distinct from /api/access-requests (self-service
 * signup, always starts "pending"): this is a system admin vouching for the
 * account up front, so it skips the approval step entirely. */
export async function POST(req: Request) {
  let claims;
  try {
    claims = requireSystemAdmin(req);
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

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = String(body.role ?? "user");
  if (!name || !email || !password) {
    return error("'name', 'email', and 'password' are required", 400);
  }
  if (password.length < 6) {
    return error("'password' must be at least 6 characters", 400);
  }
  if (!VALID_ROLES.has(role)) {
    return error("'role' must be one of: user, admin, system_admin", 400);
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return error("A user with this email already exists.", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      role,
      status: "active",
      reviewedBy: claims.sub,
      reviewedAt: new Date(),
    })
    .returning();

  await logAudit(req, {
    action: "user.create",
    entity: "users_pump",
    entityId: user.id,
    detail: `Created user ${user.email} with role ${user.role}`,
  });

  return json(userToDict(user), 201);
}
