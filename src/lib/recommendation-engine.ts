/**
 * PCP pump recommendation engine — ported line-for-line from
 * azure-functions/shared/recommendation_engine.py.
 *
 * Implements the flow chart in flow chart.xlsx / Formula.docx / the Amit
 * Sharma, Kamini and Rachna docs. Only pump_family='PCP' is supported — ROTA is
 * out of scope for this phase.
 *
 * Where the source docs left a step ambiguous (notably: exactly how the
 * viscosity factor VF composes with volumetric efficiency), the interpretation
 * used is called out in a comment at that step. This is an engineering
 * estimation tool, not a certified calculation — tested figures are always
 * preferred over calculated ones, and every calculated figure is tagged as such
 * in the response so a sales engineer can see what's a real test result vs an
 * estimate.
 *
 * NOTE: `pg` returns NUMERIC columns as strings; every numeric master value is
 * read through `toNum` before use.
 */
import { and, asc, desc, eq, gte, isNotNull, lte } from "drizzle-orm";

import { db as defaultDb } from "./db";
import * as schema from "./db/schema";
import type { ReportSection, SelectionReport } from "./report-types";
import { applyAiGapSuggestions, getAiGapSuggestions } from "./ai-suggestions";

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

// --- MOC / sealing / drive keyword matching ---------------------------------

const MOC_KEYWORDS: [string, string][] = [
  ["food", "Food & Pharma"],
  ["pharma", "Food & Pharma"],
  ["corrosive", "Corrosive Chemical"],
  ["acid", "Corrosive Chemical"],
  ["chemical", "Chemical"],
  ["oil", "Oil"],
  ["hydrocarbon", "Oil"],
];
const STATOR_KEYWORDS: [string, string][] = [
  ["food", "Food Products"],
  ["oil", "Oil & Hydrocarbon"],
  ["hydrocarbon", "Oil & Hydrocarbon"],
  ["chemical", "Chemicals"],
  ["water", "Water"],
];

export function classifyMedia(
  media: string | null,
  keywords: [string, string][],
  fallback: string,
): string {
  const mediaLower = (media || "").toLowerCase();
  for (const [kw, category] of keywords) {
    if (mediaLower.includes(kw)) return category;
  }
  return fallback;
}

export interface MocResult {
  category: string;
  casing: string | null;
  rotor: string | null;
  stator: string | null;
}

export async function resolveMoc(
  db: Db,
  media: string | null,
  temperature: number,
  solidPct: number,
): Promise<MocResult> {
  const casingCategory = classifyMedia(media, MOC_KEYWORDS, "Water");
  const rotorCategory =
    solidPct && solidPct > 0
      ? "Abrasive Slurry"
      : classifyMedia(
          media,
          [...MOC_KEYWORDS.filter((kw) => kw[1] !== "Food & Pharma"), ["food", "Food & Pharma"]],
          "Water",
        );
  const statorCategory =
    temperature && temperature > 100
      ? "High Temperature"
      : classifyMedia(media, STATOR_KEYWORDS, "Water");

  const [casing] = await db
    .select()
    .from(schema.mocSelectionGuide)
    .where(
      and(
        eq(schema.mocSelectionGuide.serviceType, casingCategory),
        isNotNull(schema.mocSelectionGuide.casingMoc),
      ),
    )
    .limit(1);
  const [rotor] = await db
    .select()
    .from(schema.mocSelectionGuide)
    .where(
      and(
        eq(schema.mocSelectionGuide.serviceType, rotorCategory),
        isNotNull(schema.mocSelectionGuide.rotorMoc),
      ),
    )
    .limit(1);
  const [stator] = await db
    .select()
    .from(schema.mocSelectionGuide)
    .where(
      and(
        eq(schema.mocSelectionGuide.serviceType, statorCategory),
        isNotNull(schema.mocSelectionGuide.statorMaterial),
      ),
    )
    .limit(1);

  return {
    category: casingCategory,
    casing: casing?.casingMoc ?? null,
    rotor: rotor?.rotorMoc ?? null,
    stator: stator?.statorMaterial ?? null,
  };
}

// moc_master (MOC Details.xlsx) uses its own 6-code nomenclature (AAAN/AABN/
// ABBN/BBBN/CCCN/XXXN) with no documented mapping to the service-type
// categories used above. This maps casing category -> moc_code by severity as a
// clearly-flagged heuristic (not from any source document).
const MOC_CODE_BY_SEVERITY: Record<string, string> = {
  Water: "AAAN",
  Oil: "AAAN",
  Chemical: "ABBN",
  "Food & Pharma": "CCCN",
  "Corrosive Chemical": "XXXN",
};

export function resolveMocMasterCode(casingCategory: string): string {
  return MOC_CODE_BY_SEVERITY[casingCategory] ?? "AAAN";
}

export function classifyRpm(rpm: number): string {
  if (rpm < 200) return "Low (<200)";
  if (rpm <= 320) return "Medium (200-320)";
  if (rpm <= 400) return "High (320-400)";
  return "Very High (>400)";
}

export async function resolveSealing(
  db: Db,
  preferred: string | null,
  hazardous: boolean,
  highPressure: boolean,
): Promise<string> {
  if (preferred === "Mechanical Seal" || preferred === "Gland Packing") {
    return preferred;
  }
  const rules = await db.select().from(schema.sealingSelectionRule);
  const msaScore = rules.reduce((acc, r) => {
    const cond = (r.condition ?? "").toLowerCase();
    const match =
      r.recommendation === "MSA" &&
      ((hazardous && cond.includes("hazardous")) ||
        (hazardous && cond.includes("toxic")) ||
        (highPressure && cond.includes("pressure")));
    return acc + (match ? 1 : 0);
  }, 0);
  return msaScore > 0 ? "Mechanical Seal" : "Gland Packing";
}

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

// --- Suction / discharge sizing ---------------------------------------------
// D = sqrt(4Q / (pi * V)) — from the "Backend Formulas Required" spec, Step-5.
const NB_SERIES = [25, 32, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 350, 400];

export function classifyMediaForVelocity(viscosityCp: number, solidPct: number): string {
  if (solidPct && solidPct >= 5) return "Slurry";
  if (viscosityCp && viscosityCp > 500) return "Viscous Liquid";
  return "Clean Liquid";
}

export async function recommendedVelocity(db: Db, mediaType: string): Promise<number> {
  const [row] = await db
    .select()
    .from(schema.suctionVelocity)
    .where(eq(schema.suctionVelocity.mediaType, mediaType))
    .limit(1);
  return row ? toNum(row.recommendedVelocity, 1.0) : 1.0;
}

export function nearestNb(diameterMm: number): number {
  for (const nb of NB_SERIES) {
    if (nb >= diameterMm) return nb;
  }
  return NB_SERIES[NB_SERIES.length - 1];
}

export async function sizeSuctionDischarge(
  db: Db,
  capacityM3hr: number,
  viscosityCp: number,
  solidPct: number,
): Promise<[number, number, string]> {
  const mediaType = classifyMediaForVelocity(viscosityCp, solidPct);
  const velocity = await recommendedVelocity(db, mediaType);
  const qM3s = capacityM3hr / 3600;
  const suctionDiamMm = Math.sqrt((4 * qM3s) / (Math.PI * velocity)) * 1000;
  const dischargeDiamMm = Math.sqrt((4 * qM3s) / (Math.PI * velocity * 1.2)) * 1000;
  return [nearestNb(suctionDiamMm), nearestNb(dischargeDiamMm), mediaType];
}

// --- Core formulas -----------------------------------------------------------

export async function roundUpToStandardKw(db: Db, kw: number): Promise<number> {
  const [row] = await db
    .select()
    .from(schema.standardMotorKw)
    .where(gte(schema.standardMotorKw.kw, String(kw)))
    .orderBy(asc(schema.standardMotorKw.kw))
    .limit(1);
  return row ? toNum(row.kw, kw) : kw;
}

/** Returns [VF, isExactMatch]. VF defaults to 1.0 if out of table range. */
export async function viscosityCorrectionFactor(
  db: Db,
  viscosityCp: number,
): Promise<[number, boolean]> {
  const [row] = await db
    .select()
    .from(schema.veCorrection)
    .where(
      and(
        eq(schema.veCorrection.pumpFamily, "PCP"),
        lte(schema.veCorrection.viscosityMin, String(viscosityCp)),
      ),
    )
    .orderBy(desc(schema.veCorrection.viscosityMin))
    .limit(1);
  if (!row) return [1.0, false];
  return [toNum(row.veCorrection, 1.0), toNum(row.viscosityMin) === viscosityCp];
}

type RpmBand = typeof schema.rpmBandMaster.$inferSelect;

export async function rpmBandFor(
  viscosityCp: number,
  solidPct: number,
  db: Db,
): Promise<RpmBand | null> {
  const bands = await db.select().from(schema.rpmBandMaster);
  for (const b of bands) {
    const vMin = toNumOrNull(b.viscosityMin);
    const vMax = toNumOrNull(b.viscosityMax);
    const maxSolid = toNumOrNull(b.maxSolidPct);
    const vOk =
      (vMin === null || viscosityCp >= vMin) && (vMax === null || viscosityCp <= vMax);
    let sOk = maxSolid === null || solidPct <= maxSolid;
    // A band with no viscosity bound at all is keyed purely by solids severity.
    // Without this guard it silently matches every viscosity, including plain
    // water at 0% solids, making a slurry-duty RPM window the default band.
    if (vMin === null && vMax === null && maxSolid !== null) {
      sOk = sOk && solidPct > 0;
    }
    if (vOk && sOk) return b;
  }
  // No genuinely applicable band — better to leave RPM-fit unconstrained than
  // to force-fit a mismatched band.
  return null;
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
    const headMax = Math.max(...points.map((p) => toNum(p.headMwc)));
    let tierLo: number;
    let tierHi: number;
    if (headMax <= 60) [tierLo, tierHi] = [0, 60];
    else if (headMax <= 120) [tierLo, tierHi] = [60, 120];
    else if (headMax <= 240) [tierLo, tierHi] = [120, 240];
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

// --- Selection report ---------------------------------------------------

function field(
  label: string,
  value: string | number | null,
  available = true,
  note: string | null = null,
): { label: string; value: string | number | null; available: boolean; note: string | null } {
  return { label, value: available ? value : null, available, note };
}

type Recommendation = typeof schema.pumpRecommendations.$inferSelect;
type Selection = typeof schema.pumpSelections.$inferSelect;

export async function buildSelectionReport(
  db: Db,
  recommendation: Recommendation,
  selection: Selection,
): Promise<SelectionReport> {
  const temperature = selection.temperature ? toNum(selection.temperature) : 0.0;
  const solidPct = selection.solidPercentage ? toNum(selection.solidPercentage) : 0.0;
  const sg = selection.sg ? toNumOrNull(selection.sg) : null;

  const casingCategory = classifyMedia(selection.media || "", MOC_KEYWORDS, "Water");
  const mocCode = resolveMocMasterCode(casingCategory);
  const [moc] = await db
    .select()
    .from(schema.mocMaster)
    .where(eq(schema.mocMaster.mocCode, mocCode))
    .limit(1);

  const rpmValue = toNumOrNull(recommendation.rpm);

  const mocField = (label: string, attr: keyof typeof schema.mocMaster.$inferSelect | null) => {
    if (attr === null || !moc) return field(label, null, false);
    const value = (moc as Record<string, unknown>)[attr] as string | null;
    return field(label, value, value !== null && value !== undefined);
  };

  // Wetted housing components default to the same grade as Pump Housing —
  // standard matched-casting practice, flagged with a note.
  const housingMoc = moc ? moc.pumpHousing : null;
  const housingNote =
    "Assumed same as Pump Housing — standard matched-casting practice, not independently charted";
  const housingField = (label: string) =>
    field(label, housingMoc, housingMoc !== null && housingMoc !== undefined, housingMoc ? housingNote : null);

  // Cardan Joint's wetted parts list includes "pin", so its MOC defaults to Pin.
  const cardanMoc = moc ? moc.pin : null;

  // Base-Plate is a non-wetted structural item, virtually always mild steel.
  const basePlateDefault = "MS";

  const driveSystem = recommendation.driveSystem || "";
  const usesGearbox = driveSystem === "Geared Motor";
  const usesShaftCoupling = driveSystem === "Geared Motor" || driveSystem === "Direct Drive";

  // Starter type follows standard LV motor-starting practice by kW rating.
  const kwMatch = /[\d.]+/.exec(recommendation.motor || "");
  const installedKw = kwMatch ? parseFloat(kwMatch[0]) : null;
  let starterType: string | null;
  if (installedKw === null) {
    starterType = null;
  } else if (installedKw < 7.5) {
    starterType = "DOL";
  } else if (installedKw <= 37) {
    starterType = "Star-Delta";
  } else {
    starterType = "VFD";
  }

  // ASF (Application Service Factor) band selected by duty severity.
  const viscosityRaw = selection.viscosity ? toNum(selection.viscosity) : 0.0;
  const viscosityForAsf = toCp(viscosityRaw, selection.viscosityUnit, sg || 1.0);
  let asfBand: string;
  if (solidPct > 15 || viscosityForAsf > 10000) {
    asfBand = "3.1+";
  } else if (solidPct > 5 || viscosityForAsf > 5000) {
    asfBand = "2.1-3";
  } else {
    asfBand = "1.4-2";
  }

  const sections: ReportSection[] = [
    {
      title: "Summary — Duty Point & Media",
      fields: [
        field("Media / Application", selection.media),
        field("Capacity", `${selection.capacity} ${selection.capacityUnit || ""}`.trim()),
        field("Head / Pressure", `${selection.head} ${selection.headUnit || ""}`.trim()),
        field(
          "Viscosity",
          selection.viscosity ? `${selection.viscosity} ${selection.viscosityUnit || ""}`.trim() : null,
          Boolean(selection.viscosity),
        ),
        field(
          "Temperature",
          selection.temperature ? `${selection.temperature} °C` : null,
          Boolean(selection.temperature),
        ),
        field("PH Value", selection.ph, Boolean(selection.ph)),
        field(
          "Density",
          sg ? `${(sg * 1000).toFixed(0)} kg/m³` : null,
          Boolean(sg),
          sg ? null : "Requires Specific Gravity input",
        ),
      ],
    },
    {
      title: "Pump Model Selection",
      fields: [
        field("Pump Model", recommendation.model),
        field("Pump Type", selection.pumpType, Boolean(selection.pumpType)),
        field("Bearing Housing", recommendation.bearingHousing, Boolean(recommendation.bearingHousing)),
        field("Suction Housing", recommendation.suctionHousing, Boolean(recommendation.suctionHousing)),
        field("Joint Type", recommendation.jointType, Boolean(recommendation.jointType)),
        field("Sealing Type", recommendation.sealingType),
        field("RPM Range", rpmValue !== null ? classifyRpm(rpmValue) : null, rpmValue !== null),
        field("Pump RPM (Final — record manually)", recommendation.rpm),
      ],
    },
    {
      title: "MOC — Non-Wettable Parts",
      fields: [housingField("Bearing Housing / Close Coupled")],
    },
    {
      title: "MOC — Wettable Housing",
      fields: [
        mocField("Pump Housing", "pumpHousing"),
        housingField("End Plate"),
        housingField("Suction Housing"),
        housingField("Pressure Check Arrangement"),
        housingField("Stuffing Box"),
        housingField("Seal Plate"),
      ],
    },
    {
      title: "MOC — Wettable Internals",
      fields: [
        mocField("Shaft", "shaft"),
        mocField("Shaft Head", "shd"),
        mocField("Coupling Rod", "cRod"),
        mocField("Sleeve", "slv"),
        mocField("Pin", "pin"),
        mocField("Bush", "bush"),
        mocField("Protector", "protector"),
        field(
          "Cardan Joint",
          cardanMoc,
          cardanMoc !== null && cardanMoc !== undefined,
          cardanMoc
            ? "Assumed same as Pin — Cardan Joint's own wetted parts list includes the pin"
            : null,
        ),
        mocField("Rotor", "rotor"),
        field(
          "Stator Sleeve",
          null,
          false,
          "Not independently charted — distinct from the Sleeve (SLV) component above",
        ),
        field(
          "Base-Plate",
          basePlateDefault,
          true,
          "Standard structural default — all MOC codes use MS for equivalent non-wetted members",
        ),
      ],
    },
    {
      title: "MOC — Elastomers",
      fields: [
        mocField("Stator", "statorRubber"),
        field("Sleeve Ring", null, false),
        field("Seal Ring", null, false),
        field("Boot Seal", null, false),
      ],
    },
    {
      title: "Suction & Discharge Details",
      fields: [
        field("Suction Size", recommendation.suctionSize, Boolean(recommendation.suctionSize)),
        field("Delivery Size", recommendation.deliverySize, Boolean(recommendation.deliverySize)),
      ],
    },
    {
      title: "Drive System",
      fields: [
        field("Drive Systems Type", recommendation.driveSystem, Boolean(recommendation.driveSystem)),
        field("Drive Motor Rating", recommendation.motor, Boolean(recommendation.motor)),
        field("Drive Motor Speed", selection.motorRpm, Boolean(selection.motorRpm)),
        field(
          "Motor Type",
          "TEFC (Totally Enclosed Fan Cooled)",
          true,
          "Standard default for industrial pump duty — revise if the site has hazardous-area classification",
        ),
        field(
          "Motor Make",
          selection.motorMake || "Standard (Kirloskar / Siemens / ABB)",
          true,
          selection.motorMake ? null : "No make specified — showing acceptable standard makes",
        ),
        field("Motor Mounting", "Foot Mounted (B3)", true, "Standard mounting default"),
        field(
          "Starter Type",
          starterType,
          starterType !== null,
          starterType ? "By installed rating: <7.5kW DOL / 7.5-37kW Star-Delta / >37kW VFD" : null,
        ),
        field("Power Supply", "415 V / 50 Hz", true, "Standard Indian industrial supply default"),
        field(
          "Gear Box Type",
          null,
          false,
          usesGearbox
            ? "HISO vs SISO depends on shaft/mounting fitment, not process inputs — needs engineering selection"
            : "Not applicable for this drive type",
        ),
        field(
          "Gear Box Model",
          null,
          false,
          usesGearbox
            ? "No gearbox selection catalog in source data — only gearbox test sheets exist"
            : "Not applicable for this drive type",
        ),
        field(
          "ASF",
          usesGearbox ? asfBand : null,
          usesGearbox,
          usesGearbox
            ? "By duty severity (solids/viscosity) per the Backend Masters ASF bands"
            : "Not applicable for this drive type",
        ),
        field(
          "Coupling Type",
          usesShaftCoupling ? "Flexible Coupling" : null,
          usesShaftCoupling,
          usesShaftCoupling
            ? "Standard default — accommodates minor shaft misalignment"
            : "Not applicable for V-Belt drive",
        ),
        field(
          "Coupling Make",
          usesShaftCoupling ? "Fenner / Lovejoy / Rexnord" : null,
          usesShaftCoupling,
          usesShaftCoupling ? "Acceptable standard makes, not a specific pick" : "Not applicable for V-Belt drive",
        ),
        field(
          "Gear Box Mounting",
          usesGearbox ? "Foot Mount (B3)" : null,
          usesGearbox,
          usesGearbox ? "Standard mounting default" : "Not applicable for this drive type",
        ),
      ],
    },
    {
      title: "Price Recommendation",
      fields: [
        field(
          "Price Band",
          "Standard",
          true,
          "Populate Gearbox/Motor price masters for an exact value — no pricing data in source docs",
        ),
      ],
    },
  ];

  // AI-suggested values for the fields with zero source data anywhere in the
  // masters. Best-effort: no-ops silently if ANTHROPIC_API_KEY isn't configured
  // or the request fails, leaving those fields "Not available" as before.
  const aiSuggestions = await getAiGapSuggestions({
    model: recommendation.model,
    media: selection.media,
    casing_category: casingCategory,
    moc_code: mocCode,
    viscosity_cp: viscosityForAsf,
    solid_pct: solidPct,
    drive_system: driveSystem,
    uses_gearbox: usesGearbox,
  });
  applyAiGapSuggestions(sections, aiSuggestions);

  return {
    recommendationId: String(recommendation.id),
    model: recommendation.model ?? "",
    mocCodeUsed: mocCode,
    sections,
  };
}
