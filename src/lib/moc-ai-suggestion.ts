/**
 * AI-assisted, per-component MOC/elastomer/sealing suggestion for the MOC &
 * Elastomer wizard step. Advisory only, clearly badged as an AI suggestion in
 * the UI, never a substitute for the manual selectors — and never throws: an
 * unset API key, a blocked response,
 * or any request failure just returns null and the caller falls back to
 * "unavailable".
 *
 * Uses Google's Gemini API (free tier via Google AI Studio) over plain
 * fetch — no SDK dependency. Requires GEMINI_API_KEY.
 *
 * Component breakdown is per the user's spec sheet: non-wettable components
 * (Bearing Housing, Bearing Plate, Tie Rod, Nut & Bolt) and wettable-casting
 * components (Pump Housing, Rotor, Shaft), plus the stator rubber elastomer.
 * MOC_AI_MATERIALS / MOC_AI_ELASTOMERS below are the options offered in the
 * UI's *manual* dropdowns — they are NOT a hard constraint on the AI's own
 * answer. The AI is free to recommend something outside those lists (e.g. an
 * exotic alloy) when the media genuinely calls for it; it's told to say so
 * explicitly rather than being forced into the closest list entry.
 */

export const MOC_AI_MATERIALS = [
  "Cast Iron",
  "Mild Steel",
  "SS410",
  "SS304",
  "SS316",
  "SS316L",
  "SDSS 2507",
  "DSS 2505",
  "Hastelloy",
  "Ni-Hard CI",
] as const;

export const MOC_AI_ELASTOMERS = [
  "Nitrile",
  "FG Nitrile",
  "White Nitrile",
  "Natural",
  "Hypalon",
  "EPDM",
  "Viton",
] as const;

export const MOC_AI_SEAL_TYPES = ["Gland Packing", "Mechanical Seal"] as const;

export interface MocAiContext {
  media: string;
  head: string | null;
  headUnit: string | null;
  capacity: string | null;
  capacityUnit: string | null;
  ph: string | null;
  temperatureC: string | null;
  viscosityCp: string | null;
  sg: string | null;
  solidPct: string | null;
  solidSize: string | null;
  solidType: string | null;
}

export interface MocComponentSuggestions {
  // Non-wettable components
  bearingHousing: string;
  bearingPlate: string;
  tieRod: string;
  nutBolt: string;
  // Wettable casting components
  pumpHousing: string;
  rotor: string;
  shaft: string;
  // Elastomer
  statorRubber: string;
  // Sealing
  sealRecommendation: string;
  sealRationale: string;
  // Report content (rendered in the UI's Summary panel and exported to PDF)
  summary: string;
  alternatives: string;
}

// "gemini-2.0-flash" returns 429 RESOURCE_EXHAUSTED (limit: 0) on the free
// tier for this key's project — "gemini-flash-latest" is the model that's
// actually available under the free tier. It's a "thinking" model (spends
// tokens on internal reasoning before the final answer, reflected as
// thoughtsTokenCount in the response), so maxOutputTokens below is set well
// above the visible JSON's size to leave room for that.
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Kept short on purpose (token cost) — media/head/capacity are the 3
// parameters that most determine the answer, so they're stated directly in
// the instruction sentence; everything else goes in the compact "Other data"
// block below, only when actually provided.
function buildPrompt(context: MocAiContext, processData: string): string {
  const head = context.head ? `${context.head} ${context.headUnit || "MWC"}` : "n/a";
  const capacity = context.capacity
    ? `${context.capacity} ${context.capacityUnit ?? ""}`.trim()
    : "n/a";
  return (
    `PCP pump. Media: ${context.media}. Head: ${head}. Capacity: ${capacity}.\n` +
    `Recommend lowest-cost reliable MOC (per component), stator elastomer, shaft seal. Prefer most economical: ${MOC_AI_MATERIALS.join(", ")}.\n` +
    `summary: detailed markdown engineering note — use ## headers, **bold**, bullet lists AND | pipe tables |, e.g. a Component/Material/Why table and a Mechanical Seal vs Gland Packing comparison table. ` +
    `alternatives: markdown with a | pipe table | of alternative materials and trade-offs.` +
    (processData ? `\nOther data:\n${processData}` : "")
  );
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    bearingHousing: { type: "string" },
    bearingPlate: { type: "string" },
    tieRod: { type: "string" },
    nutBolt: { type: "string" },
    pumpHousing: { type: "string" },
    rotor: { type: "string" },
    shaft: { type: "string" },
    statorRubber: { type: "string" },
    sealRecommendation: { type: "string", enum: [...MOC_AI_SEAL_TYPES] },
    sealRationale: { type: "string" },
    summary: { type: "string", description: "Detailed markdown: ## headers, **bold**, bullet lists, and | pipe tables |." },
    alternatives: { type: "string", description: "Markdown including a | pipe table | of alternatives and trade-offs." },
  },
  required: [
    "bearingHousing", "bearingPlate", "tieRod", "nutBolt",
    "pumpHousing", "rotor", "shaft", "statorRubber",
    "sealRecommendation", "sealRationale", "summary", "alternatives",
  ],
};

function line(label: string, value: string | null, unit = ""): string {
  return value && value.trim() !== "" ? `${label}: ${value}${unit}\n` : "";
}

export async function getMocAiSuggestion(
  context: MocAiContext,
): Promise<MocComponentSuggestions | null> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey || apiKey.startsWith("REPLACE_")) {
    return null;
  }

  const processData =
    line("pH", context.ph) +
    line("Temperature", context.temperatureC, " °C") +
    line("Viscosity", context.viscosityCp, " cP") +
    line("SG", context.sg) +
    line("Solids", context.solidPct, "%") +
    line(
      "Particle size",
      context.solidSize,
      context.solidType ? ` mm (${context.solidType})` : " mm",
    );

  const prompt = buildPrompt(context, processData);

  try {
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!res.ok) {
      console.error("Gemini MOC-suggestion request failed", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      console.warn("Gemini MOC-suggestion request did not finish normally:", finishReason);
      return null;
    }

    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as Partial<MocComponentSuggestions>;
    const required: (keyof MocComponentSuggestions)[] = [
      "bearingHousing", "bearingPlate", "tieRod", "nutBolt",
      "pumpHousing", "rotor", "shaft", "statorRubber",
      "sealRecommendation", "sealRationale", "summary", "alternatives",
    ];
    if (required.some((k) => typeof parsed[k] !== "string")) {
      return null;
    }
    return {
      bearingHousing: parsed.bearingHousing!.trim(),
      bearingPlate: parsed.bearingPlate!.trim(),
      tieRod: parsed.tieRod!.trim(),
      nutBolt: parsed.nutBolt!.trim(),
      pumpHousing: parsed.pumpHousing!.trim(),
      rotor: parsed.rotor!.trim(),
      shaft: parsed.shaft!.trim(),
      statorRubber: parsed.statorRubber!.trim(),
      sealRecommendation: parsed.sealRecommendation!.trim(),
      sealRationale: parsed.sealRationale!.trim(),
      summary: parsed.summary!.trim(),
      alternatives: parsed.alternatives!.trim(),
    };
  } catch (err) {
    console.error("Gemini MOC-suggestion request failed", err);
    return null;
  }
}
