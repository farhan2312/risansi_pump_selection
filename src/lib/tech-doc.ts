/**
 * The enquiry's Technical Data Sheet — the Risansi quotation format, one
 * column per confirmed tag:
 *
 *   letterhead · "Risansi Industries Limited - Technical Data Sheet"
 *   Client Name · Enquiry No. & Date | Quotation No. & Date
 *   Liquid Parameters · Material of Construction · Sealing Type ·
 *   Pump Details · Drive Systems
 *
 * The rows are FIXED (the format); extra parameters can be ticked per enquiry
 * (projects.tech_doc_extras) and slot into their section. Values are read from
 * the tags' CURRENT wizard data (see /api/enquiry-document), not the snapshot
 * saved at confirmation, so later edits show.
 *
 * Client-safe (no DB / DOM) — the modal, the print view and the Excel export
 * all build from here, so they can never disagree.
 */
import { finalPumpRpm, GEARED_DRIVE, VBELT_DRIVE } from "./recheck-calc";
import { phDisplay, rangeText, solidSizeDisplay, temperatureDisplay } from "./fluid-inputs";
import { ratingPlateNumber } from "./rating-plate";
import { DRIVE_GROUP_LABEL, driveGroupOf, groupsIn, type DriveGroup } from "./commercial";

// --- Letterhead (from the Risansi quotation sheet) ---------------------------

export const LETTERHEAD = {
  company: "Risansi Industries Limited",
  gst: "09AAACR6923J1Z4",
  cin: "U29150UP1996PLC020359",
  email: "headoffice@risansi.com",
  website: "www.risansi.com",
  phone: "+91 95651 26222",
  address: "123/374, Fazalganj, Kanpur-208012",
};

// --- Data the API hands over ------------------------------------------------

/** One tag's merged wizard fields (camelCase column names, as in formData). */
export type TechDocForm = Record<string, string | number | boolean | null | undefined>;

export interface TechDocPump {
  stage: number | null;
  voleMin: string | null;
  voleMax: string | null;
  mechEff: string | null;
}

export interface TechDocTag {
  tagId: string;
  tagName: string;
  form: TechDocForm;
  /** The confirmed model's row at the selected head (null if not found). */
  pump: TechDocPump | null;
}

export interface TechDocHeader {
  clientName: string;
  /** "RIL/EN/26-27/1780, Dt. 24.09.2026" — already formatted. */
  enquiry: string;
  /** "RIL/QT/SV/26-27/PCP/····, Dt. 24.09.2026", or "" without a quotation. */
  quotation: string;
}

/** ONE printable sheet: one drive group's tags, its quotation, its edits. */
export interface TechDocSheet {
  projectCode: string;
  header: TechDocHeader;
  tags: TechDocTag[];
  config: TechDocConfig;
  /** Drive group code, for the file name when the enquiry mixes drives. */
  group?: string;
}

/** Sheet key: a drive group, or "NONE" for confirmed tags with no drive. */
export type TechDocGroup = DriveGroup | "NONE";

/** Everything the API sends: the enquiry's confirmed tags and, per drive
 *  group, its quotation line and sheet edits. Split into sheets with
 *  techDocSheet(). */
export interface TechDocData {
  projectCode: string;
  clientName: string;
  /** "RIL/EN/26-27/1780, Dt. 24.09.2026" */
  enquiry: string;
  tags: TechDocTag[];
  /** The enquiry's tags span more than one drive group. */
  mixed: boolean;
  /** Drive group → "RIL/QT/…/PCP/····/GM, Dt. …" (only groups with a quotation). */
  quotations: Record<string, string>;
  /** Drive group → that sheet's edits. */
  configs: Record<string, TechDocConfig>;
}

export const techDocGroupOf = (t: TechDocTag): TechDocGroup =>
  driveGroupOf(t.form.driveSystem, t.form.gearedConfigType) ?? "NONE";

/** The sheets to show, in drive-group order ("NONE" last). */
export function techDocGroups(data: TechDocData): TechDocGroup[] {
  const present = data.tags.map(techDocGroupOf);
  const groups: TechDocGroup[] = groupsIn(present.map((g) => (g === "NONE" ? null : g)));
  return present.includes("NONE") ? [...groups, "NONE"] : groups;
}

export const techDocGroupLabel = (g: TechDocGroup): string => (g === "NONE" ? "No drive selected" : DRIVE_GROUP_LABEL[g]);

/** One drive group's printable sheet. */
export function techDocSheet(data: TechDocData, group: TechDocGroup): TechDocSheet {
  return {
    projectCode: data.projectCode,
    header: { clientName: data.clientName, enquiry: data.enquiry, quotation: data.quotations[group] ?? "" },
    tags: data.tags.filter((t) => techDocGroupOf(t) === group),
    config: data.configs[group] ?? EMPTY_TECH_DOC_CONFIG,
    group: data.mixed && group !== "NONE" ? group : undefined,
  };
}

// --- Field catalogue --------------------------------------------------------

export const TECH_DOC_SECTIONS = [
  "Liquid Parameters",
  "Material of Construction",
  "Sealing Type",
  "Pump Details",
  "Drive Systems",
] as const;
export type TechDocSection = (typeof TECH_DOC_SECTIONS)[number];

type DriveKind = "geared" | "vbelt" | "direct" | "none";

interface Ctx {
  f: TechDocForm;
  pump: TechDocPump | null;
  tagName: string;
}

export interface TechDocField {
  key: string;
  label: string;
  section: TechDocSection;
  /** Optional row — only when ticked for the enquiry. */
  extra?: boolean;
  /** Row only exists when a tag uses one of these drives (blank for the
   *  other tags). Absent = every drive. */
  drives?: DriveKind[];
  value: (c: Ctx) => string;
}

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const withUnit = (v: unknown, unit: unknown): string => (s(v) ? `${s(v)}${s(unit) ? ` ${s(unit)}` : ""}` : "");
const joinNonEmpty = (parts: string[], sep: string) => parts.filter(Boolean).join(sep);

export function driveKind(f: TechDocForm): DriveKind {
  const d = s(f.driveSystem);
  if (d === GEARED_DRIVE) return "geared";
  if (d === VBELT_DRIVE) return "vbelt";
  if (d === "Direct Drive") return "direct";
  return "none";
}

const STAGE_WORDS: Record<number, string> = { 1: "Single", 2: "Two", 4: "Four", 8: "Eight" };

/** "Flange Mount B5" → "FLANGE MOUNTED"; unknown text is kept (upper-cased). */
function mountingWords(v: unknown): string {
  const t = s(v).toLowerCase();
  if (!t) return "";
  if (t.includes("foot") && t.includes("flange")) return "FOOT CUM FLANGE MOUNTED";
  if (t.includes("flange")) return "FLANGE MOUNTED";
  if (t.includes("foot")) return "FOOT MOUNTED";
  return s(v).toUpperCase();
}

const SHAFT_WORDS: Record<string, string> = {
  HISO: "HOLLOW INPUT SOLID OUTPUT",
  SISO: "SOLID INPUT SOLID OUTPUT",
};

/** Sealing in one row: gland packing + its type, or mechanical seal + type, MOC, face. */
function sealingText(f: TechDocForm): string {
  const type = s(f.sealingType);
  if (/gland/i.test(type)) return joinNonEmpty([type, s(f.glandPackingType)], " – ");
  if (/mechanical/i.test(type)) {
    const detail = joinNonEmpty(
      [s(f.sealingSubType), s(f.mechSealMoc) && `MOC: ${s(f.mechSealMoc)}`, s(f.mechSealFace) && `Face: ${s(f.mechSealFace)}`],
      ", ",
    );
    return joinNonEmpty([type, detail], " – ");
  }
  return type;
}

/** `6" IS6392 Table 17` */
const sizeText = (size: unknown, std: unknown): string => (s(size) ? joinNonEmpty([`${s(size)}"`, s(std)], " ") : "");

/** Geared sheet: "415V/3PH/50HZ"; V-Belt sheet: "415V / 3Ph. / 50 Hz"
 *  (each as on its Risansi format). */
function powerSupplyText(f: TechDocForm): string {
  const v = ratingPlateNumber(s(f.driveMotorVoltage));
  const hz = ratingPlateNumber(s(f.driveMotorFrequency));
  const supply = s(f.drivePowerSupply);
  const n = /three/i.test(supply) ? "3" : /single/i.test(supply) ? "1" : "";
  if (driveKind(f) === "vbelt") {
    return joinNonEmpty([v && `${v}V`, n ? `${n}Ph.` : supply, hz && `${hz} Hz`], " / ");
  }
  return joinNonEmpty([v && `${v}V`, n ? `${n}PH` : supply.toUpperCase(), hz && `${hz}HZ`], "/");
}

function driveSystemText(f: TechDocForm): string {
  switch (driveKind(f)) {
    case "geared":
      return s(f.gearedConfigType) || "Geared Motor Drive";
    case "vbelt":
      return "V-Belts";
    case "direct":
      return "Direct Drive";
    default:
      return s(f.driveSystem);
  }
}

// Fixed rows, in the sheet's order; extras slot in after the fixed rows of
// their section.
export const TECH_DOC_FIELDS: TechDocField[] = [
  // Liquid Parameters
  { key: "tagNo", label: "Tag No.", section: "Liquid Parameters", value: (c) => c.tagName },
  { key: "liquid", label: "Liquid / Application", section: "Liquid Parameters", value: (c) => s(c.f.media) },
  { key: "pumpType", label: "Type of Pump", section: "Liquid Parameters", value: (c) => s(c.f.pumpType) },
  { key: "capacity", label: "Capacity", section: "Liquid Parameters", value: (c) => withUnit(c.f.capacity, c.f.capacityUnit) },
  { key: "head", label: "Head / Discharge Pressure", section: "Liquid Parameters", value: (c) => withUnit(c.f.head, c.f.headUnit) },
  {
    key: "viscosity",
    label: "Viscosity (cP)",
    section: "Liquid Parameters",
    // Canonical cP (entered cSt is converted with SG), so the label holds.
    value: (c) => rangeText(s(c.f.viscosityCp), s(c.f.viscosityCpMax), s(c.f.viscosityMode)),
  },
  { key: "sg", label: "Sp. Gravity", section: "Liquid Parameters", value: (c) => s(c.f.sg) },
  { key: "quantity", label: "Quantity", section: "Liquid Parameters", value: (c) => s(c.f.quantity) },
  { key: "pumpModel", label: "Pump Model", section: "Liquid Parameters", value: (c) => s(c.f.productCode) || s(c.f.selectedModel) },
  { key: "x_model", label: "Pump Model (Technical)", section: "Liquid Parameters", extra: true, value: (c) => s(c.f.selectedModel) },
  { key: "x_ph", label: "pH", section: "Liquid Parameters", extra: true, value: (c) => phDisplay(c.f as never) },
  { key: "x_temperature", label: "Temperature", section: "Liquid Parameters", extra: true, value: (c) => temperatureDisplay(c.f as never) },
  { key: "x_viscosityRange", label: "Viscosity Range", section: "Liquid Parameters", extra: true, value: (c) => withUnit(c.f.viscosityRange, s(c.f.viscosityRange) ? "cP" : "") },
  { key: "x_solids", label: "Solids (%)", section: "Liquid Parameters", extra: true, value: (c) => s(c.f.solidPercentage) },
  {
    key: "x_particle",
    label: "Particle Size",
    section: "Liquid Parameters",
    extra: true,
    value: (c) => (solidSizeDisplay(c.f as never) ? `${solidSizeDisplay(c.f as never)} mm${s(c.f.solidType) ? ` (${s(c.f.solidType)})` : ""}` : ""),
  },
  { key: "x_agBk", label: "AG / BK", section: "Liquid Parameters", extra: true, value: (c) => s(c.f.agBk) },
  { key: "x_suctionConn", label: "Suction Connection", section: "Liquid Parameters", extra: true, value: (c) => s(c.f.suctionConnection) },
  { key: "x_endConn", label: "End Connection (Discharge)", section: "Liquid Parameters", extra: true, value: (c) => s(c.f.endConnection) },
  {
    key: "x_negSuction",
    label: "Negative Suction",
    section: "Liquid Parameters",
    extra: true,
    value: (c) =>
      s(c.f.negativeSuction) === "Yes"
        ? `Yes${s(c.f.negativeSuctionSize) ? ` – ${s(c.f.negativeSuctionSize)} ${s(c.f.negativeSuctionUnit) || "mt"}` : ""}`
        : s(c.f.negativeSuction),
  },

  // Material of Construction (names as stored)
  { key: "bearingHousing", label: "Bearing Housing", section: "Material of Construction", value: (c) => s(c.f.mocAiBearingHousing) },
  { key: "pumpHousing", label: "Pump Housing", section: "Material of Construction", value: (c) => s(c.f.mocAiPumpHousing) },
  { key: "shaft", label: "Shaft", section: "Material of Construction", value: (c) => s(c.f.mocAiShaft) },
  { key: "rotor", label: "Rotor", section: "Material of Construction", value: (c) => s(c.f.mocAiRotor) },
  { key: "stator", label: "Stator", section: "Material of Construction", value: (c) => s(c.f.mocAiStatorRubber) },
  { key: "statorSleeve", label: "Stator Sleeve", section: "Material of Construction", value: (c) => s(c.f.mocAiStatorSleeve) },
  { key: "basePlate", label: "Base-Plate", section: "Material of Construction", value: (c) => s(c.f.mocAiBasePlate) },
  { key: "x_mountingPlate", label: "Mounting Plate", section: "Material of Construction", extra: true, value: (c) => s(c.f.mocAiMountingPlate) },
  { key: "x_tieRod", label: "Tie Rod", section: "Material of Construction", extra: true, value: (c) => s(c.f.mocAiTieRod) },
  { key: "x_nutBolt", label: "Nut & Bolt", section: "Material of Construction", extra: true, value: (c) => s(c.f.mocAiNutBolt) },

  // Sealing Type — one row with everything
  { key: "sealing", label: "Sealing Type", section: "Sealing Type", value: (c) => sealingText(c.f) },
  { key: "x_sealMake", label: "Seal / Packing Make", section: "Sealing Type", extra: true, value: (c) => s(c.f.mechSealMake) || s(c.f.glandPackingMake) },

  // Pump Details
  { key: "suctionSize", label: "Suction Size", section: "Pump Details", value: (c) => sizeText(c.f.suctionSize, c.f.suctionFlangeStd) },
  { key: "deliverySize", label: "Delivery Size", section: "Pump Details", value: (c) => sizeText(c.f.dischargeSize, c.f.dischargeFlangeStd) },
  {
    key: "pumpSpeed",
    label: "Pump Speed",
    section: "Pump Details",
    value: (c) => withUnit(finalPumpRpm(c.f as never).raw, "RPM"),
  },
  {
    key: "pumpStage",
    label: "Pump Stage",
    section: "Pump Details",
    value: (c) => (c.pump?.stage ? STAGE_WORDS[c.pump.stage] ?? String(c.pump.stage) : ""),
  },
  { key: "x_pumpSupport", label: "Pump Support & Drive Arrangement", section: "Pump Details", extra: true, value: (c) => s(c.f.bearingHousing) },
  { key: "x_suctionHousing", label: "Suction Housing", section: "Pump Details", extra: true, value: (c) => s(c.f.suctionHousing) },
  { key: "x_jointType", label: "Joint Type", section: "Pump Details", extra: true, value: (c) => s(c.f.jointType) },
  {
    key: "x_vole",
    label: "VOLE (Min–Max)",
    section: "Pump Details",
    extra: true,
    value: (c) => (c.pump?.voleMin && c.pump?.voleMax ? `${Number(c.pump.voleMin)}–${Number(c.pump.voleMax)}%` : ""),
  },
  { key: "x_mechEff", label: "Mechanical Efficiency", section: "Pump Details", extra: true, value: (c) => (c.pump?.mechEff ? `${Number(c.pump.mechEff)}%` : "") },
  { key: "x_sizeRemarks", label: "Suction / Discharge Size Remarks", section: "Pump Details", extra: true, value: (c) => s(c.f.sizeRemarks) },

  // Drive Systems — geared rows and V-belt rows only exist when a tag uses them
  { key: "driveSystem", label: "Drive Systems", section: "Drive Systems", value: (c) => driveSystemText(c.f) },
  { key: "motorRating", label: "Drive Motor Rating", section: "Drive Systems", value: (c) => withUnit(c.f.driveMotorKw, "kW") },
  { key: "motorSpeed", label: "Drive Motor Speed", section: "Drive Systems", value: (c) => withUnit(s(c.f.motorRPM) || s(c.f.driveMotorSpeed), "RPM") },
  // V-Belt format: Drive Motor Make straight after the speed.
  { key: "motorMakeVb", label: "Drive Motor Make", section: "Drive Systems", drives: ["vbelt"], value: (c) => s(c.f.driveMotorMake) },
  { key: "gbType", label: "Gear Box Type", section: "Drive Systems", drives: ["geared"], value: (c) => s(c.f.gbConstructionType) },
  { key: "gbMake", label: "Gear Box Make", section: "Drive Systems", drives: ["geared"], value: (c) => s(c.f.gearboxSource) },
  { key: "motorMake", label: "Motor Make", section: "Drive Systems", drives: ["geared", "direct", "none"], value: (c) => s(c.f.driveMotorMake) },
  { key: "gbModel", label: "Gear Box Model", section: "Drive Systems", drives: ["geared"], value: (c) => s(c.f.gearboxModel) },
  { key: "asf", label: "ASF", section: "Drive Systems", drives: ["geared"], value: (c) => s(c.f.gearboxServiceFactor) },
  { key: "couplingType", label: "Coupling Type", section: "Drive Systems", drives: ["geared"], value: (c) => s(c.f.couplingType) },
  { key: "couplingMake", label: "Coupling Make", section: "Drive Systems", drives: ["geared"], value: (c) => s(c.f.couplingMake) },
  {
    key: "gbMounting",
    label: "Gear Box Mounting",
    section: "Drive Systems",
    drives: ["geared"],
    value: (c) => joinNonEmpty([mountingWords(c.f.gearBoxMounting), SHAFT_WORDS[s(c.f.gearBoxType)] ?? s(c.f.gearBoxType)], " "),
  },
  {
    key: "motorMounting",
    label: "Motor Mounting",
    section: "Drive Systems",
    value: (c) => {
      // Geared sheet writes it in capitals, the V-Belt sheet as "Foot Mounted".
      const w = mountingWords(c.f.driveMotorMounting);
      return driveKind(c.f) === "vbelt" ? w.toLowerCase().split(" ").map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(" ") : w;
    },
  },
  {
    key: "motorType",
    label: "Motor Type",
    section: "Drive Systems",
    value: (c) =>
      joinNonEmpty([s(c.f.driveMotorEfficiency), s(c.f.driveMotorProtection)], driveKind(c.f) === "vbelt" ? " / " : "/"),
  },
  { key: "starterType", label: "Starter Type", section: "Drive Systems", value: (c) => s(c.f.driveStarterType) },
  { key: "powerSupply", label: "Power supply", section: "Drive Systems", value: (c) => powerSupplyText(c.f) },
  // V-Belt pulley details — not on the V-Belt format, so optional.
  { key: "x_pumpPulley", label: "Pump Pulley", section: "Drive Systems", extra: true, drives: ["vbelt"], value: (c) => s(c.f.drivePumpPulley) },
  { key: "x_motorPulley", label: "Motor Pulley", section: "Drive Systems", extra: true, drives: ["vbelt"], value: (c) => s(c.f.driveMotorPulley) },
  { key: "x_vbeltGroove", label: "V-Belt Groove", section: "Drive Systems", extra: true, drives: ["vbelt"], value: (c) => s(c.f.driveVbeltGroove) },
  { key: "x_vbeltNo", label: "V-Belt No.", section: "Drive Systems", extra: true, drives: ["vbelt"], value: (c) => s(c.f.driveVbeltNo) },
  { key: "x_centreDistance", label: "Centre Distance", section: "Drive Systems", extra: true, drives: ["vbelt"], value: (c) => s(c.f.driveCenterDistance) },
  { key: "x_gbShaft", label: "Gear Box Shaft Type", section: "Drive Systems", extra: true, drives: ["geared"], value: (c) => s(c.f.gearBoxType) },
  { key: "x_gbOutputRpm", label: "Gearbox Output RPM", section: "Drive Systems", extra: true, drives: ["geared"], value: (c) => withUnit(c.f.gearboxOutputRpm, "RPM") },
  { key: "x_motorFrame", label: "Motor Frame Size", section: "Drive Systems", extra: true, value: (c) => s(c.f.driveMotorFrameSize) },
  { key: "x_stdNonStd", label: "Std / Non-Std Motor", section: "Drive Systems", extra: true, value: (c) => s(c.f.driveStdNonStd) },
  {
    key: "x_vfd",
    label: "VFD",
    section: "Drive Systems",
    extra: true,
    value: (c) =>
      s(c.f.vfdRequired) === "Yes" && s(c.f.vfdMinHz) && s(c.f.vfdMaxHz)
        ? `Yes (${s(c.f.vfdMinHz)}–${s(c.f.vfdMaxHz)} Hz)`
        : s(c.f.vfdRequired),
  },
];

/** The optional rows, grouped for the picker. */
export const TECH_DOC_EXTRAS = TECH_DOC_FIELDS.filter((f) => f.extra);

/** The optional rows that apply to a sheet with these tags (pulley rows only
 *  on a V-Belt sheet, gearbox rows only on a geared one). */
export const techDocExtrasFor = (tags: TechDocTag[]): TechDocField[] => {
  const kinds = tags.map((t) => driveKind(t.form));
  return TECH_DOC_EXTRAS.filter((f) => !f.drives || kinds.some((k) => f.drives!.includes(k)));
};
export const TECH_DOC_EXTRA_KEYS = new Set(TECH_DOC_EXTRAS.map((f) => f.key));

// --- Per-enquiry customisation ----------------------------------------------

/** A row added by hand: its own name and a value per tag. */
export interface TechDocCustomRow {
  id: string;
  section: TechDocSection;
  label: string;
  /** tagId → value */
  values: Record<string, string>;
}

/** Saved per enquiry (projects.tech_doc_config). Row keys are field keys for
 *  catalogue rows and "c_<id>" for custom rows. */
export interface TechDocConfig {
  /** Optional catalogue rows added. */
  extras: string[];
  /** Rows removed from the sheet (any kind). */
  hidden: string[];
  /** Row key → renamed label. */
  labels: Record<string, string>;
  /** Row key → tagId → edited value (replaces the automatic value). */
  values: Record<string, Record<string, string>>;
  /** Rows added by hand, in order. */
  custom: TechDocCustomRow[];
}

export const EMPTY_TECH_DOC_CONFIG: TechDocConfig = { extras: [], hidden: [], labels: {}, values: {}, custom: [] };

const MAX_TEXT = 300;
const MAX_CUSTOM = 50;
const text = (v: unknown): string => String(v ?? "").trim().slice(0, MAX_TEXT);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const customKey = (id: string) => `c_${id}`;

/** Cleans whatever is stored / sent into a valid config: unknown keys,
 *  sections and over-long text are dropped. Used by the API and the screen. */
export function normalizeTechDocConfig(raw: unknown): TechDocConfig {
  const r = isObj(raw) ? raw : {};
  const custom: TechDocCustomRow[] = (Array.isArray(r.custom) ? r.custom : [])
    .filter(isObj)
    .map((c) => ({
      id: text(c.id).replace(/[^a-z0-9-]/gi, "").slice(0, 40),
      section: (TECH_DOC_SECTIONS as readonly string[]).includes(String(c.section))
        ? (c.section as TechDocSection)
        : "Liquid Parameters",
      label: text(c.label),
      values: Object.fromEntries(
        Object.entries(isObj(c.values) ? c.values : {}).map(([k, v]) => [k.slice(0, 40), text(v)]),
      ),
    }))
    .filter((c) => c.id && c.label)
    .slice(0, MAX_CUSTOM);
  const validKeys = new Set([...TECH_DOC_FIELDS.map((f) => f.key), ...custom.map((c) => customKey(c.id))]);
  const keyList = (v: unknown) =>
    [...new Set((Array.isArray(v) ? v : []).map(String).filter((k) => validKeys.has(k)))];
  const labels: Record<string, string> = {};
  for (const [k, v] of Object.entries(isObj(r.labels) ? r.labels : {})) if (validKeys.has(k) && text(v)) labels[k] = text(v);
  const values: Record<string, Record<string, string>> = {};
  for (const [k, perTag] of Object.entries(isObj(r.values) ? r.values : {})) {
    if (!validKeys.has(k) || !isObj(perTag)) continue;
    const m: Record<string, string> = {};
    for (const [tagId, v] of Object.entries(perTag)) m[tagId.slice(0, 40)] = text(v);
    if (Object.keys(m).length) values[k] = m;
  }
  return {
    extras: keyList(r.extras).filter((k) => TECH_DOC_EXTRA_KEYS.has(k)),
    hidden: keyList(r.hidden),
    labels,
    values,
    custom,
  };
}

/** Stored tech_doc_config → one config per sheet. Stored as
 *  {groups: {GM: {...}, VB: {...}}}; an older flat config applies to every
 *  sheet until that sheet is edited. */
export function normalizeTechDocConfigs(raw: unknown, groups: string[]): Record<string, TechDocConfig> {
  const r = isObj(raw) ? raw : {};
  const stored = isObj(r.groups) ? r.groups : null;
  const out: Record<string, TechDocConfig> = {};
  for (const g of groups) out[g] = normalizeTechDocConfig(stored ? stored[g] : r);
  return out;
}

// --- Build ------------------------------------------------------------------

export interface TechDocRow {
  key: string;
  kind: "fixed" | "extra" | "custom";
  label: string;
  /** The label before any rename (custom rows: their own name). */
  autoLabel: string;
  values: string[];
  /** The value from the wizard, before any edit ("" for custom rows). */
  autoValues: string[];
  /** Per tag: the value was edited for this document. */
  edited: boolean[];
  hidden: boolean;
  /** One value across all tag columns (values/edited have one entry, keyed
   *  "all" in config.values) — used by the Commercial Offer's total row. */
  span?: boolean;
}
export interface TechDocBlock {
  title: TechDocSection;
  rows: TechDocRow[];
}

/** The sheet's sections and rows for these tags, with the enquiry's
 *  customisation applied. Fixed rows always show ("-" when empty) unless
 *  removed; drive-specific rows only when a tag uses that drive; extras only
 *  when picked; custom rows at the end of their section. Removed rows are
 *  left out unless `includeHidden` (the editor lists them to restore). */
export function buildTechDoc(
  tags: TechDocTag[],
  config: TechDocConfig,
  opts: { includeHidden?: boolean } = {},
): TechDocBlock[] {
  const picked = new Set(config.extras);
  const hidden = new Set(config.hidden);
  const kinds = tags.map((t) => driveKind(t.form));
  const finish = (key: string, kind: TechDocRow["kind"], autoLabel: string, autoValues: string[]): TechDocRow => {
    const edits = config.values[key] ?? {};
    const edited = tags.map((t) => Object.prototype.hasOwnProperty.call(edits, t.tagId));
    return {
      key,
      kind,
      label: config.labels[key] || autoLabel,
      autoLabel,
      values: tags.map((t, i) => (edited[i] ? edits[t.tagId] : autoValues[i])),
      autoValues,
      edited,
      hidden: hidden.has(key),
    };
  };
  return TECH_DOC_SECTIONS.map((title) => {
    const rows: TechDocRow[] = [];
    const fields = [
      ...TECH_DOC_FIELDS.filter((f) => f.section === title && !f.extra),
      ...TECH_DOC_FIELDS.filter((f) => f.section === title && f.extra && picked.has(f.key)),
    ];
    for (const field of fields) {
      if (field.drives && !kinds.some((k) => field.drives!.includes(k))) continue;
      const auto = tags.map((t, i) =>
        field.drives && !field.drives.includes(kinds[i]) ? "" : field.value({ f: t.form, pump: t.pump, tagName: t.tagName }),
      );
      rows.push(finish(field.key, field.extra ? "extra" : "fixed", field.label, auto));
    }
    for (const c of config.custom.filter((c) => c.section === title)) {
      const key = customKey(c.id);
      // A custom row's own values are its "automatic" ones; edits go the same way.
      const row = finish(key, "custom", c.label, tags.map((t) => c.values[t.tagId] ?? ""));
      rows.push(row);
    }
    return { title, rows: opts.includeHidden ? rows : rows.filter((r) => !r.hidden) };
  });
}

// --- HTML (on-screen view + print) ------------------------------------------

/** "2026-09-24" → "24.09.2026" (the sheets' date style). */
export const dotDate = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}.${m}.${y}` : "";
};

export const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The whole sheet as a standalone HTML document (light, print-ready). Paper
 *  size / orientation stay the user's choice in the print dialog. */
export function buildTechDocHtml(data: TechDocSheet, logoUrl = "/logo.png"): string {
  const cols = Math.max(data.tags.length, 1) + 1;
  const body = buildTechDoc(data.tags, data.config)
    .filter((b) => b.rows.length > 0)
    .map(
      (b) =>
        `<tr class="band"><td colspan="${cols}">${esc(b.title)}</td></tr>` +
        b.rows
          .map(
            (r) => `<tr><th scope="row">${esc(r.label)}</th>${r.values.map((v) => `<td>${esc(v || "-")}</td>`).join("")}</tr>`,
          )
          .join(""),
    )
    .join("");
  return sheetHtml({
    projectCode: data.projectCode,
    title: "Technical Data Sheet",
    header: data.header,
    tagCount: data.tags.length,
    body,
    logoUrl,
  });
}

/** The shared printable shell of the Risansi sheets (Technical Data Sheet,
 *  Commercial Offer): letterhead, "<company> - <title>" band, client /
 *  enquiry / quotation rows, then `body` (table rows, label column + one
 *  column per tag). */
export function sheetHtml(opts: {
  projectCode: string;
  title: string;
  header: TechDocHeader;
  tagCount: number;
  /** <tr> rows for the table body. */
  body: string;
  logoUrl?: string;
  /** Extra CSS for the sheet's own row kinds. */
  css?: string;
}): string {
  const n = Math.max(opts.tagCount, 1);
  const cols = n + 1;
  // Enquiry takes the label column + half the tag columns; quotation the rest.
  const leftSpan = 1 + Math.floor(n / 2);
  const rightSpan = cols - leftSpan;
  const L = LETTERHEAD;
  const logoUrl = opts.logoUrl ?? "/logo.png";
  const body = opts.body;
  const data = { projectCode: opts.projectCode, header: opts.header };

  const colgroup = `<colgroup><col class="lbl">${Array.from({ length: n }, () => "<col>").join("")}</colgroup>`;

  return `<!doctype html>
<html><head><meta charset="utf-8">
<title>${esc(data.projectCode)} - ${esc(opts.title)}</title>
<style>
  @page { margin: 10mm; }
  * { box-sizing: border-box; }
  html { color-scheme: light; }
  body { margin: 0; padding: 12px; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { padding: 0; } }
  .sheet { max-width: 1100px; margin: 0 auto; }
  .lh { display: flex; align-items: stretch; background: #2b2b2b; color: #fff; }
  .lh .logo { background: #fff; display: flex; align-items: center; padding: 8px 18px; min-width: 190px; }
  .lh .logo img { height: 46px; }
  .lh .info { flex: 1; padding: 8px 16px; font-size: 9.5pt; line-height: 1.55; text-align: right; }
  .lh .info b { font-weight: 600; letter-spacing: .02em; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5pt; }
  col.lbl { width: 22%; }
  th, td { border: 1px solid #444; padding: 3px 6px; vertical-align: middle; word-wrap: break-word; }
  th[scope="row"] { text-align: left; font-weight: bold; background: #fff; }
  td { text-align: center; }
  tr.title td { background: #2b2b2b; color: #fff; font-weight: bold; text-align: center; font-size: 9.5pt; padding: 5px; }
  tr.meta td { text-align: left; font-size: 9pt; padding: 5px 6px; }
  tr.band td { background: #2b2b2b; color: #fff; font-weight: bold; text-align: center; padding: 4px; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  ${opts.css ?? ""}
</style></head>
<body><div class="sheet">
  <div class="lh">
    <div class="logo"><img src="${esc(logoUrl)}" alt="Risansi Industries Ltd" onerror="this.replaceWith(document.createTextNode('Risansi Industries Ltd'))"></div>
    <div class="info">
      <b>GST: ${esc(L.gst)}</b> &nbsp;|&nbsp; <b>CIN: ${esc(L.cin)}</b><br>
      &#9993; ${esc(L.email)} &nbsp;&nbsp; &#127760; ${esc(L.website)}<br>
      &#9742; ${esc(L.phone)} &nbsp;&nbsp; &#9906; ${esc(L.address)}
    </div>
  </div>
  <table>${colgroup}<tbody>
    <tr class="title"><td colspan="${cols}">${esc(L.company)} - ${esc(opts.title)}</td></tr>
    <tr class="meta"><td colspan="${cols}">Client Name: ${esc(data.header.clientName)}</td></tr>
    <tr class="meta">
      <td colspan="${leftSpan}">Enquiry No. &amp; Date: ${esc(data.header.enquiry)}</td>
      <td colspan="${rightSpan}">Quotation No. &amp; Date: ${esc(data.header.quotation || "-")}</td>
    </tr>
    ${body}
  </tbody></table>
</div></body></html>`;
}

/** Suggested file name stem: Technical-Data-Sheet_<client>_<enquiry>_<date>. */
export function techDocFileStem(data: TechDocSheet): string {
  return sheetFileStem("Technical-Data-Sheet", data);
}

/** "<Title>_<client>_<enquiry>[_<group>]_<date>" for a sheet's downloads. */
export function sheetFileStem(
  title: string,
  data: { projectCode: string; header: TechDocHeader; group?: string },
  suffix?: string,
): string {
  const slug = (v: string) => v.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return [title, slug(data.header.clientName), slug(data.projectCode), data.group ?? "", suffix ? slug(suffix) : "", new Date().toISOString().slice(0, 10)]
    .filter(Boolean)
    .join("_");
}
