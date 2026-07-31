import { eq } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { db } from "@/lib/db";
import { pumpSelectionInput } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Fields the wizard actually sends — anything else in the request body is
// ignored rather than trusted straight into the insert/update.
const FIELDS = [
  "capacity", "capacityUnit", "head", "headUnit", "media",
  "temperature", "temperatureRaw", "temperatureUnit", "sg", "ph",
  "rpmRange", "selectedModel", "modelConfirmed",
  "viscosity", "viscosityUnit", "viscosityRange", "viscosityCp",
  "solidPercentage", "solidSize", "solidType",
  "pumpType", "agBk", "bearingHousing", "suctionHousing", "jointType",
  "sealingType", "sealingSubType",
] as const;

function pickFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of FIELDS) {
    if (key in body) out[key] = body[key];
  }
  return out;
}

// Autosaved wizard state (steps 1-4) for a project — restores the form after
// a refresh. GET/PUT are keyed by projectId; there is one row per project.
export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) {
    return error("'projectId' query param is required", 400);
  }

  const [row] = await db
    .select()
    .from(pumpSelectionInput)
    .where(eq(pumpSelectionInput.projectId, projectId))
    .limit(1);

  if (!row) {
    return error("No saved input found for this project", 404);
  }
  return json(row);
}

export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const projectId = body.projectId;
  if (!projectId || typeof projectId !== "string") {
    return error("'projectId' is required", 400);
  }

  const values = pickFields(body);

  const [row] = await db
    .insert(pumpSelectionInput)
    .values({ projectId, ...values })
    .onConflictDoUpdate({
      target: pumpSelectionInput.projectId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  return json(row);
}
