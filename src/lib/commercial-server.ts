// Server-only: builds an enquiry's Commercial Summary from the wizard tables
// and the saved prices. Shared by GET /api/commercial and the quotation
// version snapshots, so both always show the same numbers.
import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  boiDrpPanel,
  boiDrpProbe,
  boiVfd,
  commercialTagPrice,
  pumpShaftDia,
  driveGearedInput,
  enquiryTags,
  generalInfoInput,
  motorDriveInput,
  projects,
  pumpModelQtyInput,
  users,
} from "@/lib/db/schema";
import {
  type CommercialReference,
  type CommercialSummary,
  type CommercialTag,
  type DriveGroup,
  type VfdMasterRow,
  drpOptionFor,
  driveGroupOf,
  emptyPrices,
  groupsIn,
  parseQuantity,
  vfdOptionsFor,
} from "@/lib/commercial";
import { VFD_YES } from "@/lib/recheck-calc";
import { gearboxUpliftedRate } from "@/lib/motor-price";

const num = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The enquiry's Commercial Summary, or null when the enquiry doesn't exist. */
export async function loadCommercialSummary(projectId: string): Promise<CommercialSummary | null> {
  const [project] = await db
    .select({
      id: projects.id,
      code: projects.projectCode,
      name: projects.name,
      customerName: projects.customerName,
      clientCode: projects.clientCode,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return null;

  const rows = await db
    .select({
      tagId: enquiryTags.id,
      tagName: enquiryTags.name,
      status: enquiryTags.status,
      model: generalInfoInput.selectedModel,
      modelConfirmed: generalInfoInput.modelConfirmed,
      media: generalInfoInput.media,
      quantity: pumpModelQtyInput.quantity,
      productCode: pumpModelQtyInput.productCode,
      driveSystem: motorDriveInput.driveSystem,
      motorMake: motorDriveInput.driveMotorMake,
      motorKw: motorDriveInput.driveMotorKw,
      motorFrame: motorDriveInput.driveMotorFrameSize,
      motorFinal: motorDriveInput.driveMotorFinalPrice,
      motorUplifted: motorDriveInput.driveMotorPriceUplifted,
      motorConfirmed: motorDriveInput.driveMotorConfirmed,
      vfdRequired: motorDriveInput.vfdRequired,
      gearedConfig: driveGearedInput.gearedConfigType,
      gbSource: driveGearedInput.gearboxSource,
      gbModel: driveGearedInput.gearboxModel,
      gbRpm: driveGearedInput.gearboxOutputRpm,
      gbRate: driveGearedInput.gearboxRatePerNos,
      gbMounting: driveGearedInput.gearBoxMounting,
      gbConfirmed: driveGearedInput.gearboxConfirmed,
      price: commercialTagPrice,
      updatedByName: users.name,
    })
    .from(enquiryTags)
    .leftJoin(generalInfoInput, eq(generalInfoInput.tagId, enquiryTags.id))
    .leftJoin(pumpModelQtyInput, eq(pumpModelQtyInput.tagId, enquiryTags.id))
    .leftJoin(motorDriveInput, eq(motorDriveInput.tagId, enquiryTags.id))
    .leftJoin(driveGearedInput, eq(driveGearedInput.tagId, enquiryTags.id))
    .leftJoin(commercialTagPrice, eq(commercialTagPrice.tagId, enquiryTags.id))
    .leftJoin(users, eq(users.id, commercialTagPrice.updatedBy))
    .where(eq(enquiryTags.projectId, projectId))
    .orderBy(asc(enquiryTags.createdAt));

  // BOI Master VFDs — small table, read once and matched per tag.
  const vfdRows: VfdMasterRow[] = (await db.select().from(boiVfd)).map((v) => ({
    driveDescription: v.driveDescription,
    make: v.make,
    series: v.series,
    frame: v.frame,
    pnKw: num(v.pnKw),
    pldKw: num(v.pldKw),
    phdKw: num(v.phdKw),
    listPrice: num(v.listPrice),
    discountPct: num(v.discountPct),
    bopExtra: num(v.bopExtra),
  }));

  // BOI Master DRP: shaft dia per model, probe sizes, the (single) panel.
  const [drpShafts, drpProbes, drpPanels] = await Promise.all([
    db.select().from(pumpShaftDia),
    db.select().from(boiDrpProbe),
    db.select().from(boiDrpPanel).orderBy(asc(boiDrpPanel.srNo)),
  ]);
  const shafts = drpShafts.map((s) => ({ model: s.model, shaftDia: num(s.shaftDia) }));
  const probes = drpProbes.map((p) => ({ description: p.description, sizeMm: Number(p.sizeMm), ratePerNos: num(p.ratePerNos) }));
  const panel = drpPanels[0] ? { description: drpPanels[0].description, ratePerNos: num(drpPanels[0].ratePerNos) } : null;

  const tags: CommercialTag[] = rows.map((r) => {
    const drp = drpOptionFor(r.model || null, shafts, probes, panel);
    const vfdRequired = r.vfdRequired === VFD_YES;
    const motorKw = num(r.motorKw);
    // A "Geared Motor" is one integrated unit: the wizard doesn't pick a
    // separate motor for it, so there is no motor reference to show.
    const motorRef: CommercialReference | null =
      r.motorMake && r.gearedConfig !== "Geared Motor"
        ? {
            label: [r.motorMake, r.motorKw ? `${r.motorKw} kW` : null, r.motorFrame ? `Frame ${r.motorFrame}` : null]
              .filter(Boolean)
              .join(" · "),
            price: num(r.motorUplifted) ?? num(r.motorFinal),
            confirmed: !!r.motorConfirmed,
          }
        : null;
    const gearboxRef: CommercialReference | null = r.gbModel
      ? {
          label: [r.gbSource, r.gbModel, r.gbRpm ? `${r.gbRpm} RPM` : null].filter(Boolean).join(" · "),
          price: gearboxUpliftedRate(r.gbRate, r.gbMounting),
          confirmed: !!r.gbConfirmed,
        }
      : null;
    const p = r.price;
    return {
      tagId: r.tagId,
      tagName: r.tagName,
      status: r.status,
      model: r.model || null,
      modelConfirmed: !!r.modelConfirmed,
      media: r.media || null,
      driveSystem: r.driveSystem || null,
      driveGroup: driveGroupOf(r.driveSystem, r.gearedConfig),
      quantity: parseQuantity(r.quantity),
      productCode: r.productCode || null,
      motorRef,
      gearboxRef,
      vfdRequired,
      motorKw,
      vfdOptions: vfdRequired ? vfdOptionsFor(vfdRows, motorKw) : [],
      drpOption: drp.option,
      drpNote: drp.note,
      prices: p
        ? {
            paPrice: num(p.paPrice),
            motorPrice: num(p.motorPrice),
            gearboxPrice: num(p.gearboxPrice),
            vfdPrice: num(p.vfdPrice),
            vfdModel: p.vfdModel || null,
            drpModel: p.drpModel || null,
            strainerPrice: num(p.strainerPrice),
            prvPrice: num(p.prvPrice),
            drpPrice: num(p.drpPrice),
            others: Array.isArray(p.others) ? p.others : [],
            remarks: p.remarks ?? "",
          }
        : emptyPrices(),
      updatedAt: p?.updatedAt ? p.updatedAt.toISOString() : null,
      updatedByName: p ? (r.updatedByName ?? null) : null,
    };
  });

  return { project, tags };
}

/** Each tag's drive group (null = no drive system yet), keyed by tag id. */
export async function tagDriveGroups(projectId: string): Promise<Map<string, DriveGroup | null>> {
  const rows = await db
    .select({ tagId: enquiryTags.id, driveSystem: motorDriveInput.driveSystem, gearedConfig: driveGearedInput.gearedConfigType })
    .from(enquiryTags)
    .leftJoin(motorDriveInput, eq(motorDriveInput.tagId, enquiryTags.id))
    .leftJoin(driveGearedInput, eq(driveGearedInput.tagId, enquiryTags.id))
    .where(eq(enquiryTags.projectId, projectId));
  return new Map(rows.map((r) => [r.tagId, driveGroupOf(r.driveSystem, r.gearedConfig)]));
}

/** The drive groups the enquiry's tags use; more than one = "mixed", which
 *  puts the group code after the quotation serial. */
export async function projectDriveGroups(projectId: string): Promise<DriveGroup[]> {
  return groupsIn([...(await tagDriveGroups(projectId)).values()]);
}
