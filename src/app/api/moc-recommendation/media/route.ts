import { asc } from "drizzle-orm";

import { json } from "@/lib/api";
import { db } from "@/lib/db";
import { mocRecommendation } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Media / Application dropdown source: the moc_recommendation reference table
// (200 curated entries from the MOC selection PDFs), replacing the old
// user-growable media_types table (dropped — this list is curated reference
// data, not something the wizard should let users freely add rows to).
export async function GET() {
  const rows = await db
    .select({ media: mocRecommendation.media })
    .from(mocRecommendation)
    .orderBy(asc(mocRecommendation.media));

  return json(rows.map((r) => r.media));
}
