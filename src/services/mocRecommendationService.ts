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

// Master option lists for the per-component MOC panel's manual dropdowns —
// mirrors src/lib/moc-ai-suggestion.ts (server-side, can't be imported into
// a client component since that file has no "use client"/DB dependency
// concerns but keeping the lists independently defined avoids ever needing
// to import a server-only module from client code).
export const MOC_AI_MATERIALS = [
  "Cast Iron",
  "Mild Steel",
  "SS304",
  "SS316",
  "SS316L",
  "SDSS 2507",
  "DSS 2505",
  "Hastelloy",
  "Ni-Hard CI",
  "SS410",
  "Others"
] as const;

export const MOC_AI_ELASTOMERS = [
  "Nitrile",
  "FG Nitrile",
  "White Nitrile",
  "Natural",
  "Hypalon",
  "EPDM",
  "Viton",
  "Others"
] as const;

export interface MocComponentSuggestions {
  bearingHousing: string;
  bearingPlate: string;
  tieRod: string;
  nutBolt: string;
  pumpHousing: string;
  rotor: string;
  shaft: string;
  statorRubber: string;
  sealRecommendation: string;
  rationale: string;
}

/** Advisory AI-generated per-component MOC/elastomer/sealing suggestion (not
 * a verified spec) — scoped to whatever process data the wizard has
 * collected so far. Returns null when the AI path is unavailable (no API key
 * configured, blocked response, or request failure) — never throws, so the
 * caller can just show "unavailable". */
export const getMocAiSuggestion = async (input: {
  media: string;
  ph?: string;
  temperatureC?: string;
  viscosityCp?: string;
  sg?: string;
  capacity?: string;
  capacityUnit?: string;
  solidPct?: string;
  solidSize?: string;
  solidType?: string;
}): Promise<MocComponentSuggestions | null> => {
  const { data, status } = await apiClient.post<MocComponentSuggestions | null>(
    "/moc-recommendation/ai-suggest",
    input,
    { validateStatus: (s) => s === 200 || s === 204 }
  );
  return status === 204 ? null : data;
};
