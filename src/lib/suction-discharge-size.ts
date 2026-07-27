/**
 * Step-5 Suction & Discharge Size — a fixed viscosity-range → size table that
 * applies to every selected model (per spec; not per-model). Above 10 000 cP
 * the numeric size (12) still applies, but the BK and AG feed/construction
 * options are additionally recommended for the thick media.
 *
 * Keys match the `viscosityRange` values the Fluid Properties step stores.
 */
export const SIZE_BY_RANGE: Record<string, number> = {
  "0-1000": 4,
  "1001-3000": 6,
  "3001-5000": 8,
  "5001-7000": 10,
  "7001-10000": 10,
  "10000+": 12,
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
  if (range === "10000+") return true;
  if (solidPct === null || solidPct === undefined || solidPct === "") return false;
  const n = typeof solidPct === "number" ? solidPct : parseFloat(String(solidPct));
  return !Number.isNaN(n) && n > 0;
}
