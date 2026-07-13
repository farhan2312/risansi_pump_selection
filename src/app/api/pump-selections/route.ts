import { error, json, selectionToDict } from "@/lib/api";
import { db } from "@/lib/db";
import { pumpSelections } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// snake_case column name -> Drizzle value key, matching the columns the old
// create_pump_selection endpoint accepted via `known_fields`.
const COLUMN_MAP: Record<string, string> = {
  project_id: "projectId",
  project_name: "projectName",
  customer_name: "customerName",
  capacity: "capacity",
  capacity_unit: "capacityUnit",
  head: "head",
  head_unit: "headUnit",
  media: "media",
  temperature: "temperature",
  sg: "sg",
  ph: "ph",
  viscosity: "viscosity",
  viscosity_unit: "viscosityUnit",
  viscosity_range: "viscosityRange",
  solid_percentage: "solidPercentage",
  solid_size: "solidSize",
  pump_type: "pumpType",
  bearing_housing: "bearingHousing",
  suction_housing: "suctionHousing",
  joint_type: "jointType",
  drive_system: "driveSystem",
  sealing_type: "sealingType",
  motor_make: "motorMake",
  gearbox_make: "gearboxMake",
  motor_rpm: "motorRpm",
};

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    const mapped = COLUMN_MAP[key];
    if (mapped) values[mapped] = value;
  }

  const [selection] = await db.insert(pumpSelections).values(values).returning();
  return json(selectionToDict(selection), 201);
}
