import apiClient from "./apiClient";

/** Media / Application list sourced from the moc_recommendation reference
 * table (curated MOC selection data — Sugar + Non-Sugar industry media). */
export const listMocMedia = async (): Promise<string[]> => {
  const { data } = await apiClient.get<string[]>("/moc-recommendation/media");
  return data;
};

// Mirrors the moc_recommendation row (Drizzle camelCase; pg NUMERIC columns
// come back as strings — parse before comparing/displaying as numbers).
export interface MocRecommendationRow {
  id: string;
  industry: string;
  sNo: number;
  media: string;
  phMin: string | null;
  phMax: string | null;
  phRaw: string | null;
  tempMin: string | null;
  tempMax: string | null;
  tempRaw: string | null;
  solidPct: string | null;
  abrasive: string | null;
  corrosive: string | null;
  minAcceptableMoc: string | null;
  recommendedMoc: string | null;
  elastomer: string | null;
  remarks: string | null;
  /** "MS" (Mechanical Seal) or "GD" (Gland Packing) — see schema.ts for the
   * derivation rule and source. */
  sealType: string | null;
}

/** Looks up the MOC + elastomer recommendation for an exact (case-insensitive)
 * media match. Returns null if no reference row exists for that media (e.g. a
 * custom/manually-typed media not in the curated list) — not an error state. */
export const lookupMocRecommendation = async (
  media: string
): Promise<MocRecommendationRow | null> => {
  try {
    const { data } = await apiClient.get<MocRecommendationRow>("/moc-recommendation/lookup", {
      params: { media },
    });
    return data;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
};
