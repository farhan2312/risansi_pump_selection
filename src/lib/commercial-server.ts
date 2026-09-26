// Server-only: builds an enquiry's Commercial Summary from the wizard tables
// and the saved prices. Shared by GET /api/commercial and the quotation
// version snapshots, so both always show the same numbers.
import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  commercialTagPrice,
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
  emptyPrices,
  parseQuantity,
} from "@/lib/commercial";
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

  const tags: CommercialTag[] = rows.map((r) => {
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
      quantity: parseQuantity(r.quantity),
      productCode: r.productCode || null,
      motorRef,
      gearboxRef,
      prices: p
        ? {
            paPrice: num(p.paPrice),
            motorPrice: num(p.motorPrice),
            gearboxPrice: num(p.gearboxPrice),
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
