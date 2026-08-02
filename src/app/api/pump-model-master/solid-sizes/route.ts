import { asc, isNotNull } from "drizzle-orm";

import { json } from "@/lib/api";
import { db } from "@/lib/db";
import { pumpModelMaster } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Distinct solid-capacity values in pump_model_master, split by type. The
// Fluid Properties step uses these to render the Solid Size as a dropdown
// filtered by the chosen Solid Type — hard/soft solids have different
// standard size classes, and the recommendation engine matches on exact
// values, so a free-text input can silently exclude every model.
export async function GET() {
  const [hard, soft] = await Promise.all([
    db
      .selectDistinct({ mm: pumpModelMaster.hardSolidMm })
      .from(pumpModelMaster)
      .where(isNotNull(pumpModelMaster.hardSolidMm))
      .orderBy(asc(pumpModelMaster.hardSolidMm)),
    db
      .selectDistinct({ mm: pumpModelMaster.softSolidMm })
      .from(pumpModelMaster)
      .where(isNotNull(pumpModelMaster.softSolidMm))
      .orderBy(asc(pumpModelMaster.softSolidMm)),
  ]);

  // NUMERIC columns come back as strings — parse to numbers so the client
  // can format/sort them numerically without another conversion step.
  return json({
    hard: hard.map((r) => Number(r.mm)).filter((n) => !Number.isNaN(n)),
    soft: soft.map((r) => Number(r.mm)).filter((n) => !Number.isNaN(n)),
  });
}
