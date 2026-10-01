import { and, asc, eq, getTableColumns, inArray, isNotNull } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import { error, json } from "@/lib/api";
import { db } from "@/lib/db";
import {
  driveDirectInput,
  driveGearedInput,
  driveVbeltInput,
  enquiryTags,
  fluidPropertiesInput,
  generalInfoInput,
  mocSealingInput,
  motorDriveInput,
  operatingConditionsInput,
  projects,
  pumpModelMaster,
  pumpModelQtyInput,
  quotation,
} from "@/lib/db/schema";
import { DRIVE_GROUPS, quotationNumber } from "@/lib/commercial";
import { projectDriveGroups } from "@/lib/commercial-server";
import {
  dotDate,
  normalizeTechDocConfig,
  normalizeTechDocConfigs,
  type TechDocData,
  type TechDocForm,
  type TechDocPump,
} from "@/lib/tech-doc";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

// Every wizard table a tag's data lives in. Their columns merge into one flat
// object (the wizard's formData shape), which lib/tech-doc reads.
const WIZARD_TABLES = [
  generalInfoInput,
  fluidPropertiesInput,
  operatingConditionsInput,
  mocSealingInput,
  motorDriveInput,
  driveDirectInput,
  driveVbeltInput,
  driveGearedInput,
  pumpModelQtyInput,
] as const;

// Uploaded files / generated PDFs — never loaded for the sheet.
const SKIP = new Set(["clientRequirementsFile", "document", "id", "projectId", "createdAt", "updatedAt"]);

/** A table's columns minus the binary / bookkeeping ones (tagId kept to key rows). */
function sheetColumns(table: PgTable): Record<string, AnyPgColumn> {
  const out: Record<string, AnyPgColumn> = {};
  for (const [key, col] of Object.entries(getTableColumns(table))) if (!SKIP.has(key)) out[key] = col as AnyPgColumn;
  return out;
}


// GET /api/enquiry-document?projectId=… — the enquiry's Technical Data Sheet
// data: header (client, enquiry, quotation), every CONFIRMED tag with its
// current wizard data + the confirmed pump's row at the picked head, and the
// sheet customisation saved for this enquiry.
export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  if (!UUID.test(projectId)) return error("'projectId' query param is required", 400);

  const [p] = await db
    .select({
      code: projects.projectCode,
      name: projects.name,
      enquiryDate: projects.enquiryDate,
      config: projects.techDocConfig,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!p) return error("Enquiry not found", 404);

  // One quotation per drive group; the group code follows the serial only
  // when the enquiry mixes drives (judged on all its tags, not just confirmed).
  const [quotes, groupsUsed] = await Promise.all([
    db.select().from(quotation).where(eq(quotation.projectId, projectId)),
    projectDriveGroups(projectId),
  ]);
  const mixed = groupsUsed.length > 1;

  // Confirmed tags only (final report generated), in creation order.
  const tagRows = await db
    .select({ id: enquiryTags.id, name: enquiryTags.name })
    .from(enquiryTags)
    .where(and(eq(enquiryTags.projectId, projectId), isNotNull(enquiryTags.reportGeneratedAt)))
    .orderBy(asc(enquiryTags.createdAt));
  const ids = tagRows.map((t) => t.id);

  const forms = new Map<string, TechDocForm>(ids.map((id) => [id, {}]));
  if (ids.length > 0) {
    const perTable = await Promise.all(
      WIZARD_TABLES.map((table) =>
        db
          .select(sheetColumns(table))
          .from(table)
          .where(inArray((table as unknown as { tagId: AnyPgColumn }).tagId, ids)),
      ),
    );
    for (const rows of perTable) {
      for (const row of rows as Record<string, unknown>[]) {
        const form = forms.get(String(row.tagId));
        if (!form) continue;
        for (const [k, v] of Object.entries(row)) {
          if (k === "tagId" || v === null || v === undefined) continue;
          form[k] = v as TechDocForm[string];
        }
      }
    }
  }

  // The confirmed model's catalogue row at the picked head (stage, VOLE, ME).
  const models = [...new Set([...forms.values()].map((f) => String(f.selectedModel ?? "")).filter(Boolean))];
  const pumpRows = models.length
    ? await db
        .select({
          model: pumpModelMaster.model,
          headMwc: pumpModelMaster.headMwc,
          stage: pumpModelMaster.stage,
          voleMin: pumpModelMaster.voleMin,
          voleMax: pumpModelMaster.voleMax,
          mechEff: pumpModelMaster.mechEff,
        })
        .from(pumpModelMaster)
        .where(inArray(pumpModelMaster.model, models))
    : [];
  const pumpFor = (f: TechDocForm): TechDocPump | null => {
    const rows = pumpRows.filter((r) => r.model === f.selectedModel);
    if (rows.length === 0) return null;
    const head = Number(f.selectedHead);
    const at = rows.find((r) => Number(r.headMwc) === head) ?? rows[0];
    return { stage: at.stage, voleMin: at.voleMin, voleMax: at.voleMax, mechEff: at.mechEff };
  };

  const data: TechDocData = {
    projectCode: p.code,
    clientName: p.name,
    enquiry: [p.code, p.enquiryDate ? `Dt. ${dotDate(p.enquiryDate)}` : ""].filter(Boolean).join(", "),
    tags: tagRows.map((t) => {
      const form = forms.get(t.id) ?? {};
      return { tagId: t.id, tagName: t.name, form, pump: pumpFor(form) };
    }),
    mixed,
    quotations: Object.fromEntries(
      quotes.map((q) => [q.driveGroup, `${quotationNumber(q, mixed)}, Dt. ${dotDate(q.quoteDate)}`]),
    ),
    configs: normalizeTechDocConfigs(p.config, [...DRIVE_GROUPS, "NONE"]),
  };
  return json(data);
}

// PUT /api/enquiry-document {projectId, group, config} — saves ONE drive
// group's sheet customisation (optional rows added, rows removed, renamed
// labels, edited values, manual rows); the other groups' sheets are kept.
// Stored as {groups: {GM: …, VB: …}}; cleaned by normalizeTechDocConfig.
export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }
  const projectId = String(body.projectId ?? "");
  const group = String(body.group ?? "");
  const sheetKeys = [...DRIVE_GROUPS, "NONE"];
  if (!UUID.test(projectId)) return error("'projectId' is required", 400);
  if (!sheetKeys.includes(group)) return error("'group' must be GM, GB, VB, DD or NONE", 400);
  const config = normalizeTechDocConfig(body.config);
  const saved = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ config: projects.techDocConfig })
      .from(projects)
      .where(eq(projects.id, projectId))
      .for("update");
    if (!row) return false;
    const all = normalizeTechDocConfigs(row.config, sheetKeys);
    all[group] = config;
    await tx
      .update(projects)
      .set({ techDocConfig: { groups: all } as unknown as Record<string, unknown> })
      .where(eq(projects.id, projectId));
    return true;
  });
  if (!saved) return error("Enquiry not found", 404);
  return json({ config });
}
