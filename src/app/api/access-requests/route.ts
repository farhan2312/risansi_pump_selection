import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { error, json, userToDict } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!name || !email || !password) {
    return error("'name', 'email', and 'password' are required", 400);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!existing) {
    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash, role: "user", status: "pending" })
      .returning();
    return json(userToDict(user), 201);
  }

  if (existing.status === "pending") {
    return error("An access request for this email is already pending.", 409);
  }
  if (existing.status === "active") {
    return error("An account already exists for this email. Please log in.", 409);
  }

  // status == "rejected" — allow resubmission
  const [updated] = await db
    .update(users)
    .set({
      name,
      passwordHash,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
    })
    .where(eq(users.id, existing.id))
    .returning();
  return json(userToDict(updated));
}
