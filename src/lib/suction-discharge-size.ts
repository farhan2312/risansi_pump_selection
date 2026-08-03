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
