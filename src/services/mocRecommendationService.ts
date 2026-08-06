import apiClient from "./apiClient";

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
  /** Short (1-2 sentence) reason for the seal pick specifically. */
  sealRationale: string;
  /** Detailed multi-paragraph engineering report — rendered in the Summary
   * panel and exported to PDF. */
  summary: string;
  /** 1-3 alternative material/elastomer combinations with trade-off notes. */
  alternatives: string;
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
