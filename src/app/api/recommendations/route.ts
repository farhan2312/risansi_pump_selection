import { error, json, toFloat } from "@/lib/api";
import { db } from "@/lib/db";
import { findCandidates, toM3PerHr, toMwc } from "@/lib/recommendation-engine";

export const dynamic = "force-dynamic";

// Step-3 model screening: capacity + head in, every model from
// pump_model_master that physically satisfies the duty point out (see
// findCandidates in recommendation-engine.ts for the formula and eligibility
// rules). No ranking/limit — selection is manual, per the spec: "system
// should give all the model that satisfy the inputs... recommendation can be
// manual selection."
//
// Nothing is persisted yet (pump_selections / pump_recommendations don't
// exist in the DB), and there are no MOC/sealing/suction-sizing/drive/motor
// fields yet either — those depend on master tables (moc_selection_guide,
// sealing_selection_rule, suction_velocity, standard_motor_kw, ve_correction,
// rpm_band_master) that haven't been built. Those parts of the wizard stay
// disabled until that data exists.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const sg = toFloat(body.sg, 1.0) || 1.0;
  const capacityRaw = toFloat(body.capacity);
  const headRaw = toFloat(body.head);
  if (capacityRaw <= 0 || headRaw <= 0) {
    return error("'capacity' and 'head' are required and must be > 0", 400);
  }

  const capacityUnit = (body.capacityUnit as string) ?? null;
  const headUnit = (body.headUnit as string) ?? null;
  const capacityM3hr = toM3PerHr(capacityRaw, capacityUnit, sg);
  const headMwc = toMwc(headRaw, headUnit, sg);

  const allCandidates = await findCandidates(db, capacityM3hr, headMwc);

  // Optional manual RPM-band filter from the General Information step (spec
  // Step-3: "final RPM selection is manual on the basis of RPM range, then
  // system will scan the pump model master for model suggestions"). Bands
  // classify on rpmAtVoleMax (the best-case, lowest-speed output).
  const rpmBand = (body.rpmRange as string) || "";
  const inBand = (rpm: number): boolean => {
    switch (rpmBand) {
      case "low":
        return rpm < 200;
      case "medium":
        return rpm >= 200 && rpm <= 320;
      case "high":
        return rpm > 320 && rpm <= 400;
      case "vhigh":
        return rpm > 400;
      default:
        return true;
    }
  };
  const candidates = allCandidates.filter((c) => inBand(c.rpmAtVoleMax));

  const selectedModel = typeof body.selectedModel === "string" ? body.selectedModel : null;

  const recommendations = candidates.map((c, i) => {
    const rpmLow = Math.round(c.rpmAtVoleMax);
    const rpmHigh = Math.round(c.rpmAtVoleMin);
    return {
      id: i,
      model: c.model,
      headMwc: c.headMwc,
      voleMin: c.voleMin,
      voleMax: c.voleMax,
      mechEff: c.mechEff,
      qth: c.qth,
      isTested: c.isTested,
      testingRemarks: c.testingRemarks,
      rpmAtVoleMin: rpmHigh,
      rpmAtVoleMax: rpmLow,
      rpmClassAtVoleMin: c.rpmClassAtVoleMin,
      rpmClassAtVoleMax: c.rpmClassAtVoleMax,
      // "2 output RPMs as per VE": VOLE MAX speed (low) .. VOLE MIN speed (high).
      rpmRange: rpmHigh > rpmLow ? `${rpmLow}–${rpmHigh}` : `${rpmLow}`,
      isSelected: selectedModel !== null && c.model === selectedModel,
    };
  });

  return json({
    input: {
      capacity: `${capacityRaw} ${capacityUnit ?? ""}`.trim(),
      head: `${headRaw} ${headUnit ?? ""}`.trim(),
    },
    recommendations,
  });
}
