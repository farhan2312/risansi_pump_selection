import { sql } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { db } from "@/lib/db";
import { mocRecommendation } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// MOC + elastomer lookup by exact (case-insensitive) media match. media names
// are unique across both industries in moc_recommendation (verified when the
// table was seeded), so this always returns at most one row.
export async function GET(req: Request) {
  const media = new URL(req.url).searchParams.get("media");
  if (!media || !media.trim()) {
    return error("'media' query param is required", 400);
  }

  const [row] = await db
    .select()
    .from(mocRecommendation)
    .where(sql`lower(${mocRecommendation.media}) = lower(${media})`)
    .limit(1);

  if (!row) {
    return error("No MOC recommendation found for this media", 404);
  }
  return json(row);
}
