import { asc, sql } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { db } from "@/lib/db";
import { mediaList } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Media / application dropdown options — pure reference list (industry +
// media only, no MOC recommendation data).
export async function GET() {
  const rows = await db
    .select({ media: mediaList.media })
    .from(mediaList)
    .orderBy(asc(mediaList.media));
  return json(rows.map((r) => r.media));
}

// Adds a media a user typed manually via "Other" on the Media dropdown, so it
// shows up in the dropdown for everyone afterwards. Upserts on the unique
// `media` column — a repeat entry of the same media is a no-op, not an error.
// `industry` isn't asked of the user at entry time, so it takes the column's
// own default ("Non-Sugar").
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const media = String(body.media ?? "").trim();
  if (!media) return error("'media' is required", 400);

  const industry = body.industry ? String(body.industry).trim() : undefined;

  const [row] = await db
    .insert(mediaList)
    .values(industry ? { media, industry } : { media })
    .onConflictDoUpdate({
      target: mediaList.media,
      set: { media: sql`${mediaList.media}` },
    })
    .returning();

  return json(row);
}
