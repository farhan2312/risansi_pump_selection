/**
 * Step-5 Suction & Discharge Size — a fixed viscosity-range → size table that
 * applies to every selected model (per spec; not per-model). Above 10 000 cP
 * the numeric size (12) still applies, but the BK and AG feed/construction
 * options are additionally recommended for the thick media.
 *
 * Keys match the `viscosityRange` values the Fluid Properties step stores.
 */
// Fallback lookup used only as a rough hint on the Fluid step (before a pump
// model is confirmed). Per-model sizes live on pump_model_master's
// size_visc_* columns and take precedence on the live pump card + summary.
// Keys match the 5 viscosity buckets from Model_vs_Viscosity_vs_Size.xlsx.
export const SIZE_BY_RANGE: Record<string, number> = {
  "0-1000": 4,
  "1000-3000": 6,
  "3000-5000": 8,
  "5000-10000": 10,
  ">10000": 12,
};

// Map a viscosity range key to the matching per-model column name on
// pump_model_master. Lets consumers pick the right size column given the
// user's chosen range without hard-coding the mapping in multiple places.
export const SIZE_COLUMN_BY_RANGE: Record<
  string,
  | "sizeVisc0To1000In"
  | "sizeVisc1000To3000In"
  | "sizeVisc3000To5000In"
  | "sizeVisc5000To10000In"
  | "sizeViscGt10000In"
> = {
  "0-1000": "sizeVisc0To1000In",
  "1000-3000": "sizeVisc1000To3000In",
  "3000-5000": "sizeVisc3000To5000In",
  "5000-10000": "sizeVisc5000To10000In",
  ">10000": "sizeViscGt10000In",
};

/** The recommended size for a stored viscosityRange, or null if unknown/unset. */
export function sizeForViscosityRange(range: string | null | undefined): number | null {
  if (!range) return null;
  const size = SIZE_BY_RANGE[range];
  return size === undefined ? null : size;
}

/**
 * The formData patch for a new size recommendation. It records the new
 * baseline and clears both remarks (a remark only ever explains a deviation
 * from the baseline being replaced). The suction & discharge inputs
 * themselves are NOT filled in - they start blank and are the user's to enter.
 *
 * Returns null when the recommendation hasn't actually changed, so an
 * override the user typed survives edits that leave the recommendation alone
 * (further viscosity keystrokes inside the same band, re-renders, re-picking
 * the same pump).
 */
export function sizeDefaultsFor(
  previousRecommended: string | null | undefined,
  recommended: number | null,
): {
  recommendedSize: string;
  suctionSizeRemarks: string;
  dischargeSizeRemarks: string;
} | null {
  const value = recommended === null ? "" : String(recommended);
  if (value === (previousRecommended ?? "")) return null;
  return {
    recommendedSize: value,
    suctionSizeRemarks: "",
    dischargeSizeRemarks: "",
  };
}

/**
 * Suction & discharge values when a pump is picked or unpicked on the live
 * panel.
 *  - Picking fills both with the model's own size (still editable after).
 *  - Unpicking clears a size that still holds that auto-filled value; a size
 *    the user typed themselves is kept.
 */
export function sizesOnPick(
  picking: boolean,
  modelSize: number | null,
  previousRecommended: string | null | undefined,
  current: { suctionSize?: string | null; dischargeSize?: string | null },
): { suctionSize: string; dischargeSize: string } {
  if (picking) {
    const v = modelSize === null ? "" : String(modelSize);
    return { suctionSize: v, dischargeSize: v };
  }
  const prev = parseFloat((previousRecommended ?? "").trim());
  const keep = (value: string | null | undefined) => {
    const t = (value ?? "").trim();
    return t && parseFloat(t) !== prev ? t : "";
  };
  return { suctionSize: keep(current.suctionSize), dischargeSize: keep(current.dischargeSize) };
}

/** The size actually being quoted: what the user entered on the Fluid step,
 * falling back to the recommendation when they haven't entered anything (or
 * typed something unparseable). Lets a display show the real number without
 * having to know whether it was overridden. */
export function sizeOverride(
  entered: string | null | undefined,
  recommended: number | null,
): number | null {
  const n = parseFloat((entered ?? "").trim());
  return Number.isNaN(n) ? recommended : n;
}

/** A size differs from the recommendation, so a remark is owed. Blank values
 * on either side don't count as a deviation — there is nothing to explain
 * until both a recommendation and a value exist. */
export function sizeDeviates(
  value: string | null | undefined,
  recommended: string | null | undefined,
): boolean {
  const a = (value ?? "").trim();
  const b = (recommended ?? "").trim();
  if (!a || !b) return false;
  // Compared numerically so 8 and 8.0 are the same size, not a deviation.
  const na = parseFloat(a);
  const nb = parseFloat(b);
  return Number.isNaN(na) || Number.isNaN(nb) ? a !== b : na !== nb;
}

/** BK/AG feed-construction options are recommended for very thick media
 * (viscosity > 10 000 cP) OR any solids content (> 0%). Either trigger opens
 * the AG/BK dropdown in the Specifications step and the note in the size box. */
export function needsBkAg(
  range: string | null | undefined,
  solidPct?: string | number | null,
): boolean {
  if (range === ">10000") return true;
  if (solidPct === null || solidPct === undefined || solidPct === "") return false;
  const n = typeof solidPct === "number" ? solidPct : parseFloat(String(solidPct));
  return !Number.isNaN(n) && n > 0;
}
