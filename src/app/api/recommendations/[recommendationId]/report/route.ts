import { eq } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { db } from "@/lib/db";
import { pumpRecommendations, pumpSelections } from "@/lib/db/schema";
import { buildSelectionReport } from "@/lib/recommendation-engine";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ recommendationId: string }> },
) {
  const { recommendationId } = await params;
  if (!UUID_RE.test(recommendationId)) {
    return error("Invalid recommendation id", 400);
  }

  const [recommendation] = await db
    .select()
    .from(pumpRecommendations)
    .where(eq(pumpRecommendations.id, recommendationId))
    .limit(1);
  if (!recommendation) {
    return error("Recommendation not found", 404);
  }

  if (!recommendation.selectionId) {
    return error("Parent selection not found", 404);
  }
  const [selection] = await db
    .select()
    .from(pumpSelections)
    .where(eq(pumpSelections.id, recommendation.selectionId))
    .limit(1);
  if (!selection) {
    return error("Parent selection not found", 404);
  }

  const report = await buildSelectionReport(db, recommendation, selection);
  return json(report);
}
