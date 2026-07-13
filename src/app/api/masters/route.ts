import { error, json } from "@/lib/api";
import { db } from "@/lib/db";
import {
  mechanicalSealChart,
  motorMaster,
  pumpModelMaster,
  suctionVelocity,
  veCorrection,
} from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Convert Drizzle's camelCase row keys back to the snake_case column names the
// old _row_to_dict() returned, so this endpoint keeps the same JSON contract.
function snakeKeys<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    out[snake] = v;
  }
  return out;
}

export async function GET() {
  try {
    const [pumpModels, ve, motors, suction, seal] = await Promise.all([
      db.select().from(pumpModelMaster),
      db.select().from(veCorrection),
      db.select().from(motorMaster),
      db.select().from(suctionVelocity),
      db.select().from(mechanicalSealChart),
    ]);

    return json({
      pumpModels: pumpModels.map(snakeKeys),
      veCorrection: ve.map(snakeKeys),
      motors: motors.map(snakeKeys),
      suctionVelocity: suction.map(snakeKeys),
      mechanicalSeal: seal.map(snakeKeys),
    });
  } catch (e) {
    console.error("masters query failed", e);
    return error("Failed to load master data", 500);
  }
}
