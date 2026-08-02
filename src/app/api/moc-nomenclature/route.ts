import { sql } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { db } from "@/lib/db";
import { mocNomenclature } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// MOC nomenclature lookup by exact (case-insensitive) 4-letter code. Given
// a code like "AAAN" or "BBBE", returns the material used for each of the 11
// metal components plus the stator rubber — one row per code, always at most
// one match (moc_code is unique in the table).
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code || !code.trim()) {
    return error("'code' query param is required", 400);
  }

  const [row] = await db
    .select()
    .from(mocNomenclature)
    .where(sql`upper(${mocNomenclature.mocCode}) = upper(${code.trim()})`)
    .limit(1);

  if (!row) {
    return error(`No MOC nomenclature found for code "${code}"`, 404);
  }
  return json(row);
}
