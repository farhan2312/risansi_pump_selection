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
import { and, eq } from "drizzle-orm";

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
  // Per "Backend Formulas Required" spec, Step-2: MWC = MLC * Specific Gravity.
  if (u === "MLC") return value * (sg || 1.0);
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
  /** Pump stage count (1/2/4/8), derived from the model name (2H*=2, 4H*=4, bare H*=1). */
  stage: number | null;
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
  /** Max hard-solid particle size this model can pass (mm), or null if unrecorded. */
  hardSolidMm: number | null;
  /** Max soft-solid particle size this model can pass (mm), or null if unrecorded. */
  softSolidMm: number | null;
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
 *
 * Optional solid-handling filter: if solidSizeMm + solidType are both given,
 * a model is excluded unless its recorded hard/soft-solid capacity (per
 * solidType) EXACTLY EQUALS solidSizeMm — the source sheet's values are a
 * fixed set of standard size classes, not a continuous minimum spec, so a
 * larger-rated model is not a valid substitute for a smaller entered size.
 * Models with no recorded capacity for that solid type are excluded too
 * (conservative — can't confirm suitability, per user decision) rather than
 * passed through unfiltered.
 */
export async function findCandidates(
  db: Db,
  capacityM3hr: number,
  headMwc: number,
  solidSizeMm: number | null = null,
  solidType: string | null = null,
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
    // not a preference. Uses the model's own `stage` column (name-derived —
    // see schema.ts) rather than inferring a tier from charted head data.
    const requiredStage = headMwc <= 60 ? 1 : headMwc <= 120 ? 2 : headMwc <= 240 ? 4 : 8;
    const stage = nearest.stage;
    if (stage !== requiredStage) continue; // Reject Model / Try Next Model

    // Hard/soft-solid capacity is a MODEL-level attribute — the same value on
    // every head-row of a model (applied uniformly when solid.xlsx was
    // seeded) — not something that varies by head, so it must NOT be read off
    // `nearest` (which is selected purely by head-proximity to the input duty
    // point). Scan the model's own rows directly instead.
    const hardSolidMm = toNumOrNull(points.find((p) => p.hardSolidMm !== null)?.hardSolidMm ?? null);
    const softSolidMm = toNumOrNull(points.find((p) => p.softSolidMm !== null)?.softSolidMm ?? null);

    // Solid-handling filter: only engages when BOTH a size and a type are
    // given (need the type to know which column applies). solid.xlsx's values
    // are a fixed set of standard size classes (7.62, 12.7, ... 60.96), not a
    // continuous minimum spec — a model is only a match for the EXACT size
    // entered, not merely "big enough" (a 35.56mm-rated model is not a valid
    // recommendation for a 30.48mm duty just because 35.56 > 30.48). A model
    // with no recorded capacity for that type is excluded too.
    if (solidSizeMm !== null && solidSizeMm > 0 && solidType) {
      const capacity = solidType === "Hard Solid" ? hardSolidMm : solidType === "Soft Solid" ? softSolidMm : null;
      // Compare to 2dp to avoid float-precision mismatches (numeric(6,2) columns).
      const matches = capacity !== null && Math.round(capacity * 100) === Math.round(solidSizeMm * 100);
      if (!matches) continue;
    }

    // RPM = 100 x Capacity / (QTH x VE). See formula note above.
    const rpmAtVoleMax = (100 * capacityM3hr) / (qth * (voleMaxPct / 100));
    const rpmAtVoleMin = (100 * capacityM3hr) / (qth * (voleMinPct / 100));

    // Wide sanity ceiling for physically-impossible values only — not a
    // preference filter, a genuine "this can't be right" guard.
    if (rpmAtVoleMax > 5000 || rpmAtVoleMax < 20) continue;

    candidates.push({
      model: modelName,
      stage,
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
      hardSolidMm,
      softSolidMm,
    });
  }

  // Informational ordering only (lowest best-case speed first — PCP pumps
  // run best slow) — NOT a cutoff. Every eligible model above is returned;
  // the caller does no top-N slicing, since selection is manual.
  candidates.sort((a, b) => a.rpmAtVoleMax - b.rpmAtVoleMax);

  return candidates;
}

// --- Motor rating (KW) --------------------------------------------------------

export interface MotorRating {
  model: string;
  /** Nearest charted head point used for the mechanical-efficiency lookup. */
  headMwc: number;
  /** Mechanical efficiency (%) at the duty head for the selected model. */
  mechEff: number;
  /** BKW = Capacity × Head / 367 / (ME/100). Null if ME is 0/absent. */
  bkw: number | null;
  /** Motor KW = BKW × 1.2 (safety margin). Null if BKW is null. */
  motorKw: number | null;
  /** Cap: the model's "Min KW so far tested". Null if not recorded. */
  minKwTested: number | null;
  /** Distinct motor-KW options for this model from the pulley table, sorted. */
  kwOptions: number[];
  /** Smallest pulley KW >= motorKw (or the largest available if none reach it). */
  recommendedKw: number | null;
  /** True when recommendedKw exceeds minKwTested — recommend it anyway, but flag. */
  exceedsMinTested: boolean;
}

/**
 * Motor Rating KW calculation (wizard step after MOC). Per the spec:
 *   ME  = selected model's mechanical efficiency at the duty head
 *   BKW = Capacity × Head / 367 / (ME/100)          ("BKW as per tested ME")
 *   Motor KW = BKW × 1.20                            (safety margin)
 *   Recommendation = nearest next-highest KW from the pulley table for this
 *     model that is >= Motor KW; normally within "Min KW so far tested", but
 *     if the load needs more than that cap the recommendation is shown anyway
 *     and flagged (exceedsMinTested).
 * Final KW selection is manual, from the pulley-table KW dropdown.
 */
export async function computeMotorRating(
  db: Db,
  model: string,
  capacityM3hr: number,
  headMwc: number,
): Promise<MotorRating | null> {
  const rows = await db
    .select()
    .from(schema.pumpModelMaster)
    .where(eq(schema.pumpModelMaster.model, model));
  if (rows.length === 0) return null;

  const nearest = rows.reduce((best, p) =>
    Math.abs(toNum(p.headMwc) - headMwc) < Math.abs(toNum(best.headMwc) - headMwc) ? p : best,
  );
  const mechEff = toNum(nearest.mechEff);
  const minKwTested = toNumOrNull(nearest.minKwTested);

  let bkw: number | null = null;
  let motorKw: number | null = null;
  if (mechEff > 0) {
    bkw = (capacityM3hr * headMwc) / 367 / (mechEff / 100);
    motorKw = bkw * 1.2;
  }

  const kwRows = await db
    .selectDistinct({ kw: schema.pulleyMotorOption.motorKw })
    .from(schema.pulleyMotorOption)
    .where(eq(schema.pulleyMotorOption.model, model));
  const kwOptions = [...new Set(kwRows.map((r) => toNum(r.kw)).filter((k) => k > 0))].sort(
    (a, b) => a - b,
  );

  let recommendedKw: number | null = null;
  let exceedsMinTested = false;
  if (motorKw !== null && kwOptions.length > 0) {
    // Smallest pulley KW that meets the load; if none reach it, the largest
    // available (best effort — the caller/UI can flag under-sizing).
    recommendedKw = kwOptions.find((k) => k >= motorKw) ?? kwOptions[kwOptions.length - 1];
    if (minKwTested !== null && recommendedKw > minKwTested) exceedsMinTested = true;
  }

  return {
    model,
    headMwc: toNum(nearest.headMwc),
    mechEff,
    bkw,
    motorKw,
    minKwTested,
    kwOptions,
    recommendedKw,
    exceedsMinTested,
  };
}

// --- V-Belt drive recommendation ---------------------------------------------

export interface VBeltOption {
  targetRpm: number;
  /** Driven (pump) pulley — the larger one in a speed reduction. */
  pumpPulley: number | null;
  /** Driving (motor) pulley. */
  motorPulley: number | null;
  /** Resulting pump speed for this pulley pair (the real achieved RPM). */
  actualRpm: number | null;
  centerDistance: number | null;
  /** V-belt reference number from the pulley master sheet. */
  vBelt: number | null;
}

export interface VBeltDrive {
  model: string;
  motorRpm: number;
  motorKw: number;
  /** Belt groove code for the matched motor option (e.g. "3B"). */
  grooves: string | null;
  /** Pump's required speed window at the duty point (from its VE band). */
  rpmLo: number;
  rpmHi: number;
  /** The recommended belt option (nearest to the required window). */
  recommended: VBeltOption | null;
  /** True if the recommendation's actual RPM lands inside [rpmLo, rpmHi];
   *  false means no belt hit the window exactly, so the nearest was taken. */
  withinRange: boolean;
  /** Every belt option for the matched motor option — lets the UI show the
   *  full table and lets the user override the pick. */
  options: VBeltOption[];
}

/**
 * V-Belt drive selection (Drive Details step, only when Drive System =
 * "V-Belt Drive"). Per the spec: after the motor RPM (960/1440) is chosen,
 * take the selected model + its motor KW (from the Motor Rating step) to find
 * the matching pulley/belt set, then pick the belt whose resulting pump speed
 * falls inside the pump's required RPM window [rpmLo, rpmHi] (derived from the
 * model's VE band at the duty point, same formula as findCandidates). The
 * pulley master offers discrete belt ratios (target RPMs 180/220/260/300/…);
 * if none lands inside the window, the nearest one is taken and flagged as a
 * "next best" pick (withinRange=false).
 */
export async function computeVBeltDrive(
  db: Db,
  model: string,
  capacityM3hr: number,
  headMwc: number,
  motorRpm: number,
  motorKw: number,
): Promise<VBeltDrive | null> {
  const rows = await db
    .select()
    .from(schema.pumpModelMaster)
    .where(eq(schema.pumpModelMaster.model, model));
  if (rows.length === 0) return null;

  const nearest = rows.reduce((best, p) =>
    Math.abs(toNum(p.headMwc) - headMwc) < Math.abs(toNum(best.headMwc) - headMwc) ? p : best,
  );
  const qth = toNumOrNull(nearest.qth);
  const voleMinPct = toNumOrNull(nearest.voleMin);
  const voleMaxPct = toNumOrNull(nearest.voleMax);
  if (!qth || qth <= 0 || !voleMinPct || !voleMaxPct) return null;

  // RPM = 100 × Q / (QTH × VE). Higher VE ⇒ lower speed, so VOLE MAX gives the
  // low end of the window and VOLE MIN the high end.
  const rpmLo = (100 * capacityM3hr) / (qth * (voleMaxPct / 100));
  const rpmHi = (100 * capacityM3hr) / (qth * (voleMinPct / 100));

  // Match the motor option by (model, motorRpm, motorKw). motor_kw is a pg
  // NUMERIC (string) — compare numerically, not by string equality.
  const motorOptions = await db
    .select()
    .from(schema.pulleyMotorOption)
    .where(
      and(
        eq(schema.pulleyMotorOption.model, model),
        eq(schema.pulleyMotorOption.motorRpm, motorRpm),
      ),
    );
  const motorOption = motorOptions.find(
    (m) => Math.abs(toNum(m.motorKw) - motorKw) < 0.001,
  );
  if (!motorOption) {
    // No pulley data for this model/rpm/kw combination.
    return {
      model,
      motorRpm,
      motorKw,
      grooves: null,
      rpmLo,
      rpmHi,
      recommended: null,
      withinRange: false,
      options: [],
    };
  }

  const beltRows = await db
    .select()
    .from(schema.pulleyBeltOption)
    .where(eq(schema.pulleyBeltOption.pulleyMotorOptionId, motorOption.id));

  const options: VBeltOption[] = beltRows
    .map((b) => ({
      targetRpm: toNum(b.targetRpm),
      pumpPulley: toNumOrNull(b.pmpPulley),
      motorPulley: toNumOrNull(b.mtrPulley),
      actualRpm: toNumOrNull(b.actualRpm),
      centerDistance: toNumOrNull(b.centerDistance),
      vBelt: toNumOrNull(b.vBelt),
    }))
    .sort((a, b) => (a.actualRpm ?? a.targetRpm) - (b.actualRpm ?? b.targetRpm));

  // Compare against the real achieved speed (actual RPM), falling back to the
  // nominal target RPM if a row somehow lacks an actual figure.
  const speed = (o: VBeltOption) => o.actualRpm ?? o.targetRpm;

  // Prefer a belt whose pump speed lands inside the window; among those, the
  // slowest adequate one (PCP pumps run best slow). Otherwise take the belt
  // nearest to the window — ties break toward the faster option so the duty
  // flow is met rather than under-delivered — and flag it as "next best".
  const inRange = options.filter((o) => speed(o) >= rpmLo && speed(o) <= rpmHi);
  let recommended: VBeltOption | null = null;
  let withinRange = false;
  if (inRange.length > 0) {
    recommended = inRange[0]; // options are sorted ascending by speed
    withinRange = true;
  } else if (options.length > 0) {
    const dist = (o: VBeltOption) => {
      const s = speed(o);
      return s < rpmLo ? rpmLo - s : s - rpmHi;
    };
    recommended = options.reduce((best, o) => {
      const d = dist(o);
      const bd = dist(best);
      if (d < bd) return o;
      if (d === bd) return speed(o) > speed(best) ? o : best;
      return best;
    });
    withinRange = false;
  }

  return {
    model,
    motorRpm,
    motorKw,
    grooves: motorOption.grooves,
    rpmLo,
    rpmHi,
    recommended,
    withinRange,
    options,
  };
}
