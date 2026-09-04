import { and, eq, sql, type SQL } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { AuthError, decodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { motorMaster } from "@/lib/db/schema";
import { mountingMatchTerms } from "@/lib/motor-mounting";

export const dynamic = "force-dynamic";

// Motor candidates for the Drive step's selection cards, screened out of
// motor_master by the motor rating the wizard has already fixed (KW) plus the
// drive inputs (RPM, mounting), and optionally narrowed by make. Separate from
// the admin-only /api/motor-master CRUD route: any authenticated user runs the
// wizard, so this one gates with decodeToken rather than requireAdmin, and is
// read-only.
export async function GET(req: Request) {
  try {
    decodeToken(req);
  } catch (e) {
    if (e instanceof AuthError) return error(e.message, e.statusCode);
    throw e;
  }

  const params = new URL(req.url).searchParams;
  const kwRaw = params.get("kw");
  if (!kwRaw || Number.isNaN(parseFloat(kwRaw))) {
    return error("'kw' query param is required and must be a number", 400);
  }

  const filters: SQL[] = [
    // Numeric compare, not string — "5.5" must match a stored "5.500".
    sql`${motorMaster.motorKw} = ${parseFloat(kwRaw)}`,
  ];

  const rpm = params.get("rpm");
  if (rpm && !Number.isNaN(parseInt(rpm, 10))) {
    filters.push(eq(motorMaster.motorRpm, parseInt(rpm, 10)));
  }

  // Mounting. The wizard's value is a label carrying its IEC code ("Foot B3",
  // "Flange B5", "Foot cum Flange B35"); the master stores the descriptive
  // part on its own ("FOOT"). Match the FULL descriptive text, not the first
  // word — "Foot cum Flange" is its own mounting, and matching on "Foot" made
  // it silently return plain foot-mounted motors. The IEC code is accepted as
  // an alternative so rows stored as "B35" match too.
  //
  // motor_master currently holds FOOT rows only, so Flange/Foot-cum-Flange
  // correctly return nothing until that data is loaded — deliberately NOT
  // falling back to FOOT, which would misreport a foot motor as satisfying a
  // B5/B35 requirement.
  const mounting = params.get("mounting");
  if (mounting && mounting.trim()) {
    const { text, code } = mountingMatchTerms(mounting);
    // Normalise the stored value the same way the label is normalised, so
    // "Foot-cum-Flange" / "FOOT CUM FLANGE" compare equal.
    const stored = sql`btrim(regexp_replace(upper(${motorMaster.mounting}), '[^A-Z0-9]+', ' ', 'g'))`;
    filters.push(
      code
        ? sql`(${stored} = ${text} OR ${stored} = ${code})`
        : sql`${stored} = ${text}`,
    );
  }

  const make = params.get("make");
  if (make && make.trim()) {
    filters.push(sql`upper(${motorMaster.brand}) = upper(${make.trim()})`);
  }

  // Efficiency (IE) class — the Drive step's Efficiency select maps onto
  // motor_type, so picking IE3 offers only IE3 motors.
  const motorType = params.get("motorType");
  if (motorType && motorType.trim()) {
    filters.push(sql`upper(${motorMaster.motorType}) = upper(${motorType.trim()})`);
  }

  const rows = await db
    .select()
    .from(motorMaster)
    .where(and(...filters))
    .orderBy(motorMaster.brand, motorMaster.frameSize);

  return json(rows);
}
