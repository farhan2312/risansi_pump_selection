/**
 * Commercial Summary (pricing v1, manual) — shared types and the totals maths.
 * Client-safe: no DB import. Used by the API route and the page, so the page's
 * live totals and anything computed server-side can never disagree.
 *
 * Every price is per unit and typed in by the quotation team:
 *   unit price = Pump & Accessories + every BOI item (fixed rows + Others)
 *   sub-total  = unit price × quantity (quantity from the wizard's Pump Model & Qty step)
 *   grand total = sum of every tag's sub-total
 */

/** The fixed BOI rows, in display order. `key` is the API/DB field. */
export const BOI_ITEMS = [
  { key: "motorPrice", label: "Motor" },
  { key: "gearboxPrice", label: "Gearbox" },
  { key: "vfdPrice", label: "VFD" },
  { key: "strainerPrice", label: "Strainer" },
  { key: "prvPrice", label: "PRV" },
  { key: "drpPrice", label: "DRP" },
] as const;

export type BoiKey = (typeof BOI_ITEMS)[number]["key"];

export type CommercialOther = { name: string; price: number | null };

/** The editable prices of one tag (numbers, or null when not entered). */
export type CommercialPrices = {
  paPrice: number | null;
  /** The BOI Master VFD picked for vfdPrice (drive description), if any.
   *  Missing on quotation snapshots made before VFD was added. */
  vfdModel: string | null;
  /** The BOI Master DRP kit used for drpPrice ("RTD probe 50 mm + RTD panel"),
   *  if any. Missing on older quotation snapshots. */
  drpModel: string | null;
  others: CommercialOther[];
  remarks: string;
} & Record<BoiKey, number | null>;

/** What the wizard already knows about a tag's pick — shown next to the
 *  manual price as a reference, never applied automatically. */
export type CommercialReference = {
  /** e.g. "Siemens · 5.5 kW · Frame 132S" */
  label: string;
  /** Price from the master (uplifted where the wizard applied an uplift). */
  price: number | null;
  confirmed: boolean;
};

export type CommercialTag = {
  tagId: string;
  tagName: string;
  status: string;
  model: string | null;
  modelConfirmed: boolean;
  media: string | null;
  driveSystem: string | null;
  /** GM / GB / VB / DD, or null until the Drive step has a drive system. */
  driveGroup: DriveGroup | null;
  /** Parsed from pump_model_qty_input.quantity; null when missing/invalid. */
  quantity: number | null;
  /** ERP pump product code picked on the Pump Model & Qty step. */
  productCode: string | null;
  motorRef: CommercialReference | null;
  gearboxRef: CommercialReference | null;
  /** Drive step answer "VFD Required" = Yes. */
  vfdRequired: boolean;
  /** Drive motor kW the VFD is matched against (null when not entered). */
  motorKw: number | null;
  /** BOI Master drives covering motorKw — only when vfdRequired. */
  vfdOptions: VfdOption[];
  /** BOI Master DRP kit for the tag's model (every tag), or null with the
   *  reason in drpNote. */
  drpOption: DrpOption | null;
  drpNote: string | null;
  prices: CommercialPrices;
  updatedAt: string | null;
  updatedByName: string | null;
};

export type CommercialSummary = {
  project: {
    id: string;
    code: string;
    name: string;
    customerName: string | null;
    clientCode: string | null;
  };
  tags: CommercialTag[];
};

export const MAX_OTHER_ITEMS = 10;

export const emptyPrices = (): CommercialPrices => ({
  paPrice: null,
  motorPrice: null,
  gearboxPrice: null,
  vfdPrice: null,
  vfdModel: null,
  drpModel: null,
  strainerPrice: null,
  prvPrice: null,
  drpPrice: null,
  others: [],
  remarks: "",
});

// --- VFD (BOI Master, VFD tab) ---------------------------------------------

export type VfdDuty = "Nominal" | "Light Duty" | "Heavy Duty";

/** One boi_vfd row as the matcher needs it (numbers already parsed). */
export type VfdMasterRow = {
  driveDescription: string;
  make: string;
  series: string | null;
  frame: string | null;
  pnKw: number | null;
  pldKw: number | null;
  phdKw: number | null;
  listPrice: number | null;
  discountPct: number | null;
  bopExtra: number | null;
};

/** A drive offered for a tag: the smallest one covering the motor kW for at
 *  least one duty (a drive can be the pick for several duties). */
export type VfdOption = {
  driveDescription: string;
  make: string;
  series: string | null;
  frame: string | null;
  duties: { duty: VfdDuty; kw: number }[];
  listPrice: number | null;
  discountPct: number | null;
  bopExtra: number | null;
  /** list × (1 − discount%) + BOP extra, rounded to the paisa. */
  netPrice: number | null;
};

const VFD_DUTY_KW: { duty: VfdDuty; kw: (r: VfdMasterRow) => number | null }[] = [
  { duty: "Nominal", kw: (r) => r.pnKw },
  { duty: "Light Duty", kw: (r) => r.pldKw },
  { duty: "Heavy Duty", kw: (r) => r.phdKw },
];

/** VFD cost: list less the discount, plus the flat BOP extra per VFD. */
export const vfdNetPrice = (
  listPrice: number | null,
  discountPct: number | null,
  bopExtra: number | null,
): number | null =>
  listPrice === null
    ? null
    : Math.round((listPrice * (1 - (discountPct ?? 0) / 100) + (bopExtra ?? 0)) * 100) / 100;

/** Per duty, the smallest drive whose rating for that duty is ≥ the motor kW
 *  (the cheaper one on a tie); drives picked by more than one duty merge into
 *  one option. Ordered Nominal → Heavy Duty (smallest drive first). */
export function vfdOptionsFor(rows: VfdMasterRow[], motorKw: number | null): VfdOption[] {
  if (motorKw === null || !(motorKw > 0)) return [];
  const byDrive = new Map<string, VfdOption>();
  for (const { duty, kw } of VFD_DUTY_KW) {
    const best = rows
      .filter((r) => (kw(r) ?? -1) >= motorKw)
      .sort((a, b) => kw(a)! - kw(b)! || (a.listPrice ?? Infinity) - (b.listPrice ?? Infinity))[0];
    if (!best) continue;
    const opt = byDrive.get(best.driveDescription) ?? {
      driveDescription: best.driveDescription,
      make: best.make,
      series: best.series,
      frame: best.frame,
      duties: [],
      listPrice: best.listPrice,
      discountPct: best.discountPct,
      bopExtra: best.bopExtra,
      netPrice: vfdNetPrice(best.listPrice, best.discountPct, best.bopExtra),
    };
    opt.duties.push({ duty, kw: kw(best)! });
    byDrive.set(best.driveDescription, opt);
  }
  return [...byDrive.values()];
}

// --- DRP (BOI Master, DRP tab) ----------------------------------------------
// Dry Run Protection per pump = RTD probe + RTD panel. The probe is the
// smallest size ≥ the model's shaft dia (pump_shaft_dia, one row per model).

export type DrpShaftRow = { model: string; shaftDia: number | null };
export type DrpProbeRow = { description: string; sizeMm: number; ratePerNos: number | null };
export type DrpPanelRow = { description: string; ratePerNos: number | null };

export type DrpOption = {
  shaftDia: number;
  probeSizeMm: number;
  probeRate: number | null;
  panelRate: number | null;
  /** probe + panel. */
  total: number;
  /** Saved as commercial_tag_price.drp_model when used. */
  label: string;
};


/** The DRP kit for a model, or the reason there isn't one. */
export function drpOptionFor(
  model: string | null,
  shafts: DrpShaftRow[],
  probes: DrpProbeRow[],
  panel: DrpPanelRow | null,
): { option: DrpOption | null; note: string | null } {
  if (!model) return { option: null, note: "No pump model selected yet" };
  const key = model.trim().toUpperCase();
  const shaftDia = shafts.find((s) => s.model.trim().toUpperCase() === key)?.shaftDia ?? null;
  if (shaftDia === null) return { option: null, note: `No shaft dia for ${model} in the BOI Master Shaft Dia tab` };
  const probe = probes.filter((p) => p.sizeMm >= shaftDia).sort((a, b) => a.sizeMm - b.sizeMm)[0];
  if (!probe) return { option: null, note: `No RTD probe of ${shaftDia} mm or more in the BOI Master` };
  const panelRate = panel?.ratePerNos ?? null;
  return {
    option: {
      shaftDia,
      probeSizeMm: probe.sizeMm,
      probeRate: probe.ratePerNos,
      panelRate,
      total: Math.round(((probe.ratePerNos ?? 0) + (panelRate ?? 0)) * 100) / 100,
      label: `RTD probe ${probe.sizeMm} mm${panel ? " + RTD panel" : ""}`,
    },
    note: null,
  };
}

/** Sum of the BOI items only (fixed rows + Others), per unit. */
export function boiTotal(p: CommercialPrices): number {
  const fixed = BOI_ITEMS.reduce((s, it) => s + (p[it.key] ?? 0), 0);
  return fixed + p.others.reduce((s, o) => s + (o.price ?? 0), 0);
}

/** P&A + all BOI, per unit. */
export const unitTotal = (p: CommercialPrices): number => (p.paPrice ?? 0) + boiTotal(p);

/** Unit total × quantity. A missing quantity counts as 0 so an unfinished tag
 *  never inflates the grand total; the page flags it instead. */
export const subTotal = (p: CommercialPrices, quantity: number | null): number =>
  unitTotal(p) * (quantity ?? 0);

export const grandTotal = (tags: { prices: CommercialPrices; quantity: number | null }[]): number =>
  tags.reduce((s, t) => s + subTotal(t.prices, t.quantity), 0);

/** Whole number ≥ 1, else null. */
export function parseQuantity(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  return /^[1-9]\d*$/.test(s) ? Number(s) : null;
}

/** A price as the user may send it: number, numeric string, "" or null.
 *  Returns undefined for anything invalid (negative, not a number, too big). */
export function parsePrice(raw: unknown): number | null | undefined {
  if (raw === null || raw === "" || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0 || n >= 1e12) return undefined;
  return Math.round(n * 100) / 100;
}

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** "₹1,50,000" (Indian grouping); "—" for null. */
export const formatInr = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : `₹${INR.format(n)}`;

// --- Quotation (v1) ----------------------------------------------------------
// One quotation per enquiry, independent of the sales portal. Number:
// RIL/QT/<region>/<FY>/<PCP|SPR>/<serial>; region = the TSM's initials for
// now; the serial is ON HOLD (who issues it is undecided) and shows as a gap.

export type QuotationTrack = "internal" | "client";

/** A sales (Market Intell) user who can be the TSM. */
export type TsmOption = {
  id: number;
  name: string;
  initials: string;
  zone: string | null;
  role: string;
};

/** Frozen copy of the prices when a version was made. */
export type QuotationSnapshot = {
  tags: {
    tagName: string;
    productCode: string | null;
    model: string | null;
    quantity: number | null;
    prices: CommercialPrices;
    unit: number;
    sub: number;
  }[];
  grandTotal: number;
};

export type QuotationVersionInfo = {
  id: string;
  track: QuotationTrack;
  version: number;
  reason: string | null;
  /** Internal versions: who asked for the changes ("TSM"). */
  requestedBy: string | null;
  /** Internal versions: what they asked to change. */
  note: string | null;
  /** The live internal version — its snapshot is the current saved prices. */
  live: boolean;
  tsmName: string | null;
  tsmInitials: string | null;
  snapshot: QuotationSnapshot;
  createdAt: string | null;
  createdByName: string | null;
};

export type QuotationInfo = {
  id: string;
  /** The drive group it covers (GM / GB / VB / DD). */
  driveGroup: string;
  /** Includes the "/GM" suffix when the enquiry mixes drives. */
  number: string;
  productType: string;
  quoteDate: string;
  finYear: string;
  serial: number | null;
  regionCode: string | null;
  tsmRepId: number | null;
  tsmName: string | null;
  tsmInitials: string | null;
  tsmZone: string | null;
  clientCode: string | null;
  clientName: string | null;
  internalVersion: number;
  /** null until the quotation is first sent to the client. */
  clientVersion: number | null;
  versions: QuotationVersionInfo[];
};

/** Indian financial year (Apr–Mar) of a yyyy-mm-dd date: 2026-09-26 → "2627". */
export function finYearOf(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

/** "RIL/QT/SV/26-27/PCP/····" — the serial is shown as a gap until it exists.
 *  fin_year is stored as "2627" and printed as "26-27". With `mixed` (the
 *  enquiry has tags on more than one drive system) the quotation's drive group
 *  goes after the serial: ".../PCP/····/GM". */
export function quotationNumber(
  q: {
    regionCode: string | null;
    finYear: string;
    productType: string;
    serial: number | null;
    driveGroup?: string | null;
  },
  mixed = false,
): string {
  const fy = /^\d{4}$/.test(q.finYear) ? `${q.finYear.slice(0, 2)}-${q.finYear.slice(2)}` : q.finYear;
  const parts: (string | number)[] = ["RIL", "QT", q.regionCode || "—", fy, q.productType, q.serial ?? "····"];
  if (mixed && q.driveGroup) parts.push(q.driveGroup);
  return parts.join("/");
}

/** "V0" / "V3"; "Not sent" for a client track that has no version yet. */
export const versionLabel = (v: number | null): string => (v === null ? "Not sent" : `V${v}`);

// --- Drive groups --------------------------------------------------------------
// An enquiry's tags are quoted per drive system: one quotation (own versions),
// one price summary and one data sheet per group. The code goes after the
// serial in the quotation number only when the enquiry mixes drives.

export const DRIVE_GROUPS = ["GM", "GB", "VB", "DD"] as const;
export type DriveGroup = (typeof DRIVE_GROUPS)[number];

export const DRIVE_GROUP_LABEL: Record<DriveGroup, string> = {
  GM: "Geared Motor",
  GB: "Gear Box + Motor",
  VB: "V-Belt",
  DD: "Direct",
};

export const isDriveGroup = (v: unknown): v is DriveGroup => (DRIVE_GROUPS as readonly string[]).includes(String(v));

/** A tag's group from its Drive step: null until a drive system is chosen. */
export function driveGroupOf(driveSystem: unknown, gearedConfigType: unknown): DriveGroup | null {
  const d = String(driveSystem ?? "");
  if (d === "V-Belt Drive") return "VB";
  if (d === "Direct Drive") return "DD";
  if (d.startsWith("Geared")) return String(gearedConfigType ?? "") === "Gear Box + Motor" ? "GB" : "GM";
  return null;
}

/** The groups present, in DRIVE_GROUPS order. */
export const groupsIn = (groups: (DriveGroup | null)[]): DriveGroup[] =>
  DRIVE_GROUPS.filter((g) => groups.includes(g));
