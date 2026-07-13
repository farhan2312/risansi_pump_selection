import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { createToken } from "@/lib/auth";
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

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) {
    return error("'email' and 'password' are required", 400);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return error("Invalid email or password.", 401);
  }

  if (user.status === "pending") {
    return error("Your access request is still pending admin approval.", 403);
  }
  if (user.status === "rejected") {
    return error("Your access request was rejected. Contact an administrator.", 403);
  }

  const token = createToken({ id: user.id, email: user.email, role: user.role });
  return json({
    token,
    user: { id: String(user.id), name: user.name, email: user.email, role: user.role },
  });
}
