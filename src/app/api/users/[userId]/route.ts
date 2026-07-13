import { eq } from "drizzle-orm";

import { error, json, userToDict } from "@/lib/api";
import { AuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  let claims;
  try {
    claims = requireAdmin(req);
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

  const newStatus = body.status;
  if (newStatus !== "active" && newStatus !== "rejected") {
    return error("'status' must be 'active' or 'rejected'", 400);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return error("User not found", 404);
  }
  if (user.status !== "pending") {
    return error("This request has already been reviewed.", 409);
  }

  const [updated] = await db
    .update(users)
    .set({ status: newStatus, reviewedBy: claims.sub, reviewedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  return json(userToDict(updated));
}
