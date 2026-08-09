import { eq } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { db } from "@/lib/db";
import {
  generalInfoInput,
  fluidPropertiesInput,
  operatingConditionsInput,
  mocSealingInput,
  motorDriveInput,
  driveDirectInput,
  driveVbeltInput,
  driveGearedInput,
} from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// One generic route family for all 8 wizard autosave tables, keyed by the
// [table] URL segment — same pattern as /api/gearbox-master/[table]. Each
// table has a unique projectId (one row per project), so GET/PUT are both
// keyed by projectId, not a row id.
const TABLES = {
  "general-info": generalInfoInput,
  "fluid-properties": fluidPropertiesInput,
  "operating-conditions": operatingConditionsInput,
  "moc-sealing": mocSealingInput,
  "motor-drive": motorDriveInput,
  "drive-direct": driveDirectInput,
  "drive-vbelt": driveVbeltInput,
  "drive-geared": driveGearedInput,
} as const;

type TableKey = keyof typeof TABLES;

// Fields the wizard actually sends per table — anything else in the request
// body is ignored rather than trusted straight into the insert/update.
const FIELDS: Record<TableKey, readonly string[]> = {
  "general-info": [
    "capacity", "capacityUnit", "head", "headUnit", "media",
    "temperature", "temperatureRaw", "temperatureUnit", "sg", "ph",
    "rpmRange", "selectedModel", "modelConfirmed",
  ],
  "fluid-properties": [
    "viscosity", "viscosityUnit", "viscosityRange", "viscosityCp",
    "solidPercentage", "solidSize", "solidType",
  ],
  "operating-conditions": [
    "pumpType", "agBk", "bearingHousing", "suctionHousing", "jointType",
  ],
  "moc-sealing": [
    "sealingType", "sealingSubType",
    "mocAiBearingHousing", "mocAiBearingHousingRemarks",
    "mocAiBearingPlate", "mocAiBearingPlateRemarks",
    "mocAiTieRod", "mocAiTieRodRemarks",
    "mocAiNutBolt", "mocAiNutBoltRemarks",
    "mocAiPumpHousing", "mocAiPumpHousingRemarks",
    "mocAiRotor", "mocAiRotorRemarks",
    "mocAiShaft", "mocAiShaftRemarks",
    "mocAiStatorRubber", "mocAiStatorRubberRemarks",
    "mocAiProvider",
    "mocAiSuggestedBearingHousing", "mocAiSuggestedBearingPlate",
    "mocAiSuggestedTieRod", "mocAiSuggestedNutBolt", "mocAiSuggestedPumpHousing",
    "mocAiSuggestedRotor", "mocAiSuggestedShaft", "mocAiSuggestedStatorRubber",
    "mocAiGeneratedAt",
  ],
  "motor-drive": ["driveMotorKw", "driveSystem", "motorRPM"],
  // No fields today — the table exists for structural symmetry (see
  // schema.ts). PUT still succeeds, it just creates/touches an empty row.
  "drive-direct": [],
  "drive-vbelt": [
    "driveVbeltGroove", "drivePumpPulley", "driveMotorPulley", "driveVbeltRpm",
    "driveCenterDistance", "driveVbeltNo", "driveMotorSpeed", "driveMotorMake",
    "driveMotorMounting", "driveMotorEfficiency", "driveMotorProtection",
    "driveMotorFrequency", "driveMotorVoltage", "driveStarterType",
    "drivePowerSupply", "driveStdNonStd",
  ],
  "drive-geared": [
    "gearBoxType", "gearedConfigType", "gbConstructionType", "gearBoxMounting",
    "driveCoupling", "asfRange", "gearboxSource", "gearboxModel",
    "gearboxOutputRpm", "gearboxServiceFactor", "gearboxRatePerNos",
  ],
};

function resolveTableKey(key: string): TableKey | null {
  return Object.prototype.hasOwnProperty.call(TABLES, key) ? (key as TableKey) : null;
}

function pickFields(tableKey: TableKey, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of FIELDS[tableKey]) {
    if (key in body) out[key] = body[key];
  }
  return out;
}

// Autosaved wizard state for a project, one table per wizard step (see
// schema.ts for the full split rationale). No auth gate here — same as the
// projects route, this is a small internal tool with no per-user ownership
// concept; the /pump-selection page itself is already gated by middleware.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ table: string }> },
) {
  const { table: tableParam } = await params;
  const tableKey = resolveTableKey(tableParam);
  if (!tableKey) return error(`Unknown wizard-input table "${tableParam}"`, 400);
  const table = TABLES[tableKey];

  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) {
    return error("'projectId' query param is required", 400);
  }

  const [row] = await db
    .select()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(table as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq((table as any).projectId, projectId))
    .limit(1);

  if (!row) {
    return error("No saved input found for this project", 404);
  }
  return json(row);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ table: string }> },
) {
  const { table: tableParam } = await params;
  const tableKey = resolveTableKey(tableParam);
  if (!tableKey) return error(`Unknown wizard-input table "${tableParam}"`, 400);
  const table = TABLES[tableKey];

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

  const values = pickFields(tableKey, body);

  const result = await db
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(table as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .values({ projectId, ...values } as any)
    .onConflictDoUpdate({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      target: (table as any).projectId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [row] = result as any[];

  return json(row);
}
