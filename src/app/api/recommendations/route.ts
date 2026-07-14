import { error, json, toFloat } from "@/lib/api";
import { db } from "@/lib/db";
import { pumpRecommendations, pumpSelections } from "@/lib/db/schema";
import {
  findCandidates,
  resolveDrive,
  resolveMoc,
  resolveSealing,
  sizeSuctionDischarge,
  toCp,
  toM3PerHr,
  toMwc,
} from "@/lib/recommendation-engine";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  // Live wizard preview: run the engine and return results WITHOUT persisting a
  // pump_selection / pump_recommendation row (so the panel updating on every
  // keystroke doesn't flood the DB). The final "Confirm" call omits ?preview.
  const preview = new URL(req.url).searchParams.get("preview") === "1";

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const sg = toFloat(body.sg, 1.0) || 1.0;
  const capacityRaw = toFloat(body.capacity);
  const headRaw = toFloat(body.head);
  const viscosityRaw = toFloat(body.viscosity);
  const temperature = toFloat(body.temperature);
  const solidPct = toFloat(body.solidPercentage);
  const motorRpm = toFloat(body.motorRPM, 0) || null;

  if (capacityRaw <= 0 || headRaw <= 0) {
    return error("'capacity' and 'head' are required and must be > 0", 400);
  }

  const capacityUnit = (body.capacityUnit as string) ?? null;
  const headUnit = (body.headUnit as string) ?? null;
  const viscosityUnit = (body.viscosityUnit as string) ?? null;
  const media = (body.media as string) ?? "";

  const capacityM3hr = toM3PerHr(capacityRaw, capacityUnit, sg);
  const headMwc = toMwc(headRaw, headUnit, sg);
  const viscosityCp = toCp(viscosityRaw, viscosityUnit, sg);

  // Optional manual RPM-band filter from General Information (spec Step-3:
  // "final RPM selection is manual on the basis of RPM range, then scan the
  // model master"). Bands classify the required RPM at VE_max.
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

  const candidates = (
    await findCandidates(db, capacityM3hr, headMwc, viscosityCp, solidPct, motorRpm)
  )
    .filter((c) => inBand(c.rpmRequired))
    .slice(0, 5);

  const moc = await resolveMoc(db, media, temperature, solidPct);
  const mocStr =
    [
      moc.casing ? `Casing: ${moc.casing}` : null,
      moc.rotor ? `Rotor: ${moc.rotor}` : null,
      moc.stator ? `Stator: ${moc.stator}` : null,
    ]
      .filter(Boolean)
      .join(", ") || null;

  const mediaLower = media.toLowerCase();
  const hazardous = mediaLower.includes("chemical") || mediaLower.includes("acid");
  const highPressure = headMwc > 60;
  const sealingType = await resolveSealing(db, body.sealingType as string, hazardous, highPressure);

  const [suctionNb, dischargeNb] = await sizeSuctionDischarge(
    db,
    capacityM3hr,
    viscosityCp,
    solidPct,
  );

  const projectId =
    typeof body.projectId === "string" && UUID_RE.test(body.projectId) ? body.projectId : null;

  // Persist the parent selection only for a real (non-preview) submission.
  let selectionId: string | null = null;
  if (!preview) {
    const [selection] = await db
      .insert(pumpSelections)
      .values({
        projectId,
        projectName: (body.projectName as string) ?? null,
        customerName: (body.customerName as string) ?? null,
        capacity: (body.capacity as string) ?? null,
        capacityUnit,
        head: (body.head as string) ?? null,
        headUnit,
        media: (body.media as string) ?? null,
        temperature: (body.temperature as string) ?? null,
        sg: (body.sg as string) ?? null,
        ph: (body.ph as string) ?? null,
        viscosity: (body.viscosity as string) ?? null,
        viscosityUnit,
        viscosityRange: (body.viscosityRange as string) ?? null,
        solidPercentage: (body.solidPercentage as string) ?? null,
        solidSize: (body.solidSize as string) ?? null,
        pumpType: (body.pumpType as string) ?? null,
        bearingHousing: (body.bearingHousing as string) ?? null,
        suctionHousing: (body.suctionHousing as string) ?? null,
        jointType: (body.jointType as string) ?? null,
        driveSystem: (body.driveSystem as string) ?? null,
        sealingType: (body.sealingType as string) ?? null,
        motorMake: (body.motorMake as string) ?? null,
        gearboxMake: (body.gearboxMake as string) ?? null,
        motorRpm: (body.motorRPM as string) ?? null,
      })
      .returning();
    selectionId = String(selection.id);
  }

  const results = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const drive = resolveDrive(c.rpmRequired, motorRpm);

    // "2 output RPMs as per VE": VE_max speed (low) .. VE_min speed (high).
    const rpmLow = Math.round(c.rpmRequired);
    const rpmHigh = Math.round(c.rpmMinVe);
    const rpmRange = rpmHigh > rpmLow ? `${rpmLow}–${rpmHigh}` : `${rpmLow}`;

    const base = {
      model: c.model,
      rpm: c.rpmRequired.toFixed(0),
      flow: `${capacityRaw} ${capacityUnit ?? ""}`.trim(),
      head: `${headRaw} ${headUnit ?? ""}`.trim(),
      bearingHousing: (body.bearingHousing as string) ?? null,
      suctionHousing: (body.suctionHousing as string) ?? null,
      jointType: (body.jointType as string) ?? null,
      sealingType,
      moc: mocStr,
      suctionSize: `${suctionNb} NB`,
      deliverySize: `${dischargeNb} NB`,
      motor: c.installedKw ? `${c.installedKw.toFixed(2)} kW` : null,
      driveSystem: drive,
      score: c.score.toFixed(0),
      availability: "Unknown",
      tested: c.isTested ? "Yes" : "No",
      reportNo: null as string | null,
      rejectionReasons: c.rejectionReasons.length > 0 ? c.rejectionReasons : null,
    };

    let recommendationId: string | null = null;
    if (!preview) {
      const [rec] = await db
        .insert(pumpRecommendations)
        .values({ selectionId, ...base })
        .returning();
      recommendationId = String(rec.id);
    }

    results.push({
      id: i,
      recommendationId,
      ...base,
      rpmRange,
      dataSource: {
        performanceCurve: c.isTested ? "tested" : "calculated",
        kw: c.kwSource,
      },
    });
  }

  return json({ selectionId, recommendations: results });
}
