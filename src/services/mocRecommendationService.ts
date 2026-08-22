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

// Mirrors src/lib/moc-ai-suggestion.ts's MOC_AI_PROVIDERS — kept as an
// independent client-side literal for the same reason MOC_AI_MATERIALS is
// (that file has server-only concerns and can't be imported into a client
// component).
export const MOC_AI_PROVIDERS = [
  { value: "gemini", label: "Gemini" },
  { value: "anthropic", label: "Claude Haiku 4.5" },
] as const;
export type MocAiProvider = (typeof MOC_AI_PROVIDERS)[number]["value"];

export interface MocComponentSuggestions {
  bearingHousing: string;
  basePlate: string;
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

/** Why the AI path produced no suggestion: "not_configured" = no usable API
 * key for the chosen provider; "failed" = key present but the upstream call
 * errored, was blocked, or was overloaded (e.g. Gemini 503). The UI maps
 * these to different messages. */
export type MocAiUnavailable = { unavailable: "not_configured" | "failed" };

/** Advisory AI-generated per-component MOC/elastomer/sealing suggestion (not
 * a verified spec) — scoped to whatever process data the wizard has
 * collected so far. Resolves to the suggestion on success, or a
 * `{ unavailable }` reason otherwise (distinguish with `"unavailable" in x`).
 * Only throws on a genuine transport/HTTP error (axios), which the caller
 * treats as a failed request. */
export const getMocAiSuggestion = async (input: {
  media: string;
  head?: string;
  headUnit?: string;
  ph?: string;
  temperatureC?: string;
  viscosityCp?: string;
  sg?: string;
  capacity?: string;
  capacityUnit?: string;
  solidPct?: string;
  solidSize?: string;
  solidType?: string;
  /** Which LLM to use — defaults server-side to "gemini" if omitted. */
  provider?: MocAiProvider;
}): Promise<MocComponentSuggestions | MocAiUnavailable> => {
  const { data } = await apiClient.post<MocComponentSuggestions | MocAiUnavailable>(
    "/moc-recommendation/ai-suggest",
    input
  );
  return data;
};
