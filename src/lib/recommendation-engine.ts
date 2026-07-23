/**
 * PCP pump recommendation engine — ported line-for-line from
 * azure-functions/shared/recommendation_engine.py.
 *
 * Implements the flow chart in flow chart.xlsx / Formula.docx / the Amit
 * Sharma, Kamini and Rachna docs. Only pump_family='PCP' is supported — ROTA is
 * out of scope for this phase.
 *
 * This is an engineering estimation tool, not a certified calculation — tested
 * figures are always preferred over calculated ones, and every calculated
 * figure is tagged as such in the response so a sales engineer can see what's
 * a real test result vs an estimate.
 *
 * NOTE: `pg` returns NUMERIC columns as strings; every numeric master value is
 * read through `toNum` before use.
 *
 * Only Step-3 model screening (this file's `findCandidates`) is wired up right
 * now. MOC resolution, sealing resolution, suction/discharge sizing, motor-kW
 * rounding, viscosity correction, RPM-band lookup, and the full selection
 * report were removed because their master tables (moc_selection_guide,
 * sealing_selection_rule, suction_velocity, standard_motor_kw, ve_correction,
 * rpm_band_master, moc_master) and the persistence tables (pump_selections,
 * pump_recommendations) don't exist in the DB yet — keeping that code in would
 * fail the production build the moment any of those tables were dropped from
 * schema.ts. Re-add each piece once its master table is built.
 */
import { db as defaultDb } from "./db";
import * as schema from "./db/schema";

type Db = typeof defaultDb;

function toNum(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isNaN(n) ? fallback : n;
}

function toNumOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isNaN(n) ? null : n;
}

// --- Unit conversion -------------------------------------------------------

export function toM3PerHr(value: number, unit: string | null, sg: number): number {
  const u = (unit || "M3/hr").trim();
  if (u === "M3/hr") return value;
  if (u === "LPH") return value / 1000;
  if (u === "GPM") return value * 0.227125; // US gallons/min
  if (u === "KLPD") return value / 24; // kiloliters/day
  if (u === "TPH") return value / (sg || 1.0); // tons/hr, needs density
  return value;
}

export function toMwc(value: number, unit: string | null, sg: number): number {
  const u = (unit || "MWC").trim();
  if (u === "MWC") return value;
  // Per "Backend Formulas Required" spec, Step-2: MWC = MLC / Specific Gravity.
  if (u === "MLC") return value / (sg || 1.0);
  // Per spec, Step-2: "Head = Pressure * 10" for both Bar and Kg/cm2.
  if (u === "Bar") return value * 10.0;
  if (u === "Kg/cm2" || u === "Kg/cm²") return value * 10.0;
  return value;
}

export function toCp(value: number, unit: string | null, sg: number): number {
  const u = (unit || "cP").trim();
  if (u === "cSt") return value * (sg || 1.0);
  return value;
}

export function classifyRpm(rpm: number): string {
  if (rpm < 200) return "Low (<200)";
  if (rpm <= 320) return "Medium (200-320)";
  if (rpm <= 400) return "High (320-400)";
  return "Very High (>400)";
}

// --- Drive helpers (not yet wired into a wizard step — no motor-speed input
// flows through findCandidates right now; kept for the future Drive Details
// step, since neither function depends on any DB table). ---------------------

export function reductionRatio(
  motorRpm: number | null,
  rpmRequired: number,
): number | null {
  if (!motorRpm || rpmRequired <= 0) return null;
  return motorRpm / rpmRequired;
}

export function resolveDrive(rpmRequired: number, motorRpm: number | null): string {
  const ratio = reductionRatio(motorRpm, rpmRequired);
  if (ratio === null) return "Geared Motor";
  if (ratio >= 0.9 && ratio <= 1.1) return "Direct Drive";
  // V-belt/pulley reduction is practical up to roughly 6:1; beyond that a
  // gearbox is the realistic option (engineering rule of thumb, flagged).
  if (ratio > 1 && ratio <= 6) return "V-Belt Drive";
  return "Geared Motor";
}

export interface Candidate {
  model: string;
  /** Nearest charted head point (in pump_model_master) to the input duty head. */
  headMwc: number;
  voleMin: number;
  voleMax: number;
  mechEff: number;
  qth: number;
  /** True if this model has no "NOT TESTED" remark at the matched head. */
  isTested: boolean;
  testingRemarks: string | null;
  /** RPM computed using VOLE MIN (lower efficiency ⇒ the higher-speed case). */
  rpmAtVoleMin: number;
  /** RPM computed using VOLE MAX (higher efficiency ⇒ the lower, best-case speed). */
  rpmAtVoleMax: number;
  rpmClassAtVoleMin: string;
  rpmClassAtVoleMax: string;
}

type ModelRow = typeof schema.pumpModelMaster.$inferSelect;

/**
 * Step-3 model screening: given a duty point (capacity + head), scans
 * pump_model_master and returns EVERY model that can physically satisfy it —
 * no scoring, no ranking, no top-N cutoff. Per the spec: "system should give
 * all the model that satisfy the inputs... recommendation can be manual
 * selection" — the sales engineer picks the final model from this list.
 *
 * RPM formula (per the Step-3 spec): RPM = Q ÷ (Displacement × VE). QTH in
 * pump_model_master is this model's theoretical flow at a 100 RPM reference
 * speed rather than a literal per-revolution displacement, so
 * Displacement ≡ QTH / 100 and the formula becomes RPM = 100 × Q / (QTH × VE)
 * — the same ratio, just expressed against this sheet's QTH convention.
 * Two RPMs are returned per model, one per VOLE bound — the sheet's "2
 * output RPMs as per VE": VOLE MIN (lower efficiency ⇒ higher required
 * speed) and VOLE MAX (higher efficiency ⇒ lower, best-case speed).
 */
export async function findCandidates(
  db: Db,
  capacityM3hr: number,
  headMwc: number,
): Promise<Candidate[]> {
  const rows = await db.select().from(schema.pumpModelMaster);

  const byModel = new Map<string, ModelRow[]>();
  for (const r of rows) {
    const list = byModel.get(r.model) ?? [];
    list.push(r);
    byModel.set(r.model, list);
  }

  const candidates: Candidate[] = [];
  for (const [modelName, points] of byModel) {
    const nearest = points.reduce((best, p) =>
      Math.abs(toNum(p.headMwc) - headMwc) < Math.abs(toNum(best.headMwc) - headMwc) ? p : best,
    );

    const qth = toNumOrNull(nearest.qth);
    if (qth === null || qth <= 0) continue; // no theoretical-flow data — RPM not calculable

    const voleMinPct = toNumOrNull(nearest.voleMin);
    const voleMaxPct = toNumOrNull(nearest.voleMax);
    if (voleMinPct === null || voleMaxPct === null || voleMinPct <= 0 || voleMaxPct <= 0) continue;

    // Stage-tier constraint: PCP models come in non-overlapping head bands by
    // stage count (backend spec Step-4): <=60 MWC = single, 60-120 = 2-stage,
    // 120-240 = 4-stage, 240-480 = 8-stage. A single-stage model can't be
    // recommended for a 90 MWC duty just because 90 is "close" to 60 — this
    // is a hard catalog limit ("RPM within Model Limit? NO -> Reject Model"),
    // not a preference. headMax is this model's furthest charted head point.
   // const headMax = Math.max(...points.map((p) => toNum(p.headMwc)));
    let tierLo: number;
    let tierHi: number;
    if (headMwc <= 60) [tierLo, tierHi] = [0, 60];
    else if (headMwc <= 120) [tierLo, tierHi] = [60, 120];
    else if (headMwc <= 240) [tierLo, tierHi] = [120, 240];
    else [tierLo, tierHi] = [240, 480];
    if (!(tierLo < headMwc && headMwc <= tierHi)) continue; // Reject Model / Try Next Model

    // RPM = 100 x Capacity / (QTH x VE). See formula note above.
    const rpmAtVoleMax = (100 * capacityM3hr) / (qth * (voleMaxPct / 100));
    const rpmAtVoleMin = (100 * capacityM3hr) / (qth * (voleMinPct / 100));

    // Wide sanity ceiling for physically-impossible values only — not a
    // preference filter, a genuine "this can't be right" guard.
    if (rpmAtVoleMax > 5000 || rpmAtVoleMax < 20) continue;

    candidates.push({
      model: modelName,
      headMwc: toNum(nearest.headMwc),
      voleMin: voleMinPct,
      voleMax: voleMaxPct,
      mechEff: toNum(nearest.mechEff),
      qth,
      isTested: nearest.testingRemarks === null,
      testingRemarks: nearest.testingRemarks,
      rpmAtVoleMin,
      rpmAtVoleMax,
      rpmClassAtVoleMin: classifyRpm(rpmAtVoleMin),
      rpmClassAtVoleMax: classifyRpm(rpmAtVoleMax),
    });
  }

  // Informational ordering only (lowest best-case speed first — PCP pumps
  // run best slow) — NOT a cutoff. Every eligible model above is returned;
  // the caller does no top-N slicing, since selection is manual.
  candidates.sort((a, b) => a.rpmAtVoleMax - b.rpmAtVoleMax);
  return candidates;
}
