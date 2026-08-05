/**
 * AI-assisted, per-component MOC/elastomer/sealing suggestion for the MOC &
 * Elastomer wizard step. Advisory only, clearly badged as an AI suggestion in
 * the UI, never a substitute for the curated moc_recommendation table or the
 * manual selectors — and never throws: an unset API key, a blocked response,
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
  "SS304",
  "SS316",
  "SS316L",
  "SDSS 2507",
  "DSS 2505",
  "Hastelloy",
  "Ni-Hard CI",
  "SS410",
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
  ph: string | null;
  temperatureC: string | null;
  viscosityCp: string | null;
  sg: string | null;
  capacity: string | null;
  capacityUnit: string | null;
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

const PROMPT_INSTRUCTIONS = `You are a senior rotating-equipment engineer selecting the material \
of construction (MOC), stator elastomer, and shaft seal for a progressive cavity (single screw) \
pump, for an economical-first sales engineering tool.

Guiding principle: recommend the most economical materials that will give reliable service for \
the stated duty — do not over-specify. Cast Iron / Mild Steel / SS410 / SS304 are perfectly \
correct answers for mild, non-corrosive, low-temperature duty; reach for SS316, duplex stainless \
(SDSS 2507 / DSS 2505), Hastelloy, or specialty elastomers only when the process data actually \
justifies it (corrosivity, temperature, oxidizers, chlorides, hazard).

Component reference (for material components — housings, structural fasteners, rotor, shaft):
${MOC_AI_MATERIALS.join(", ")}. This is a reference list of what's normally stocked, not a hard
constraint — if the duty genuinely calls for something outside it (e.g. an exotic alloy, a coated
or lined option, PTFE, etc.), recommend that instead and say explicitly why the standard list
isn't sufficient.

Elastomer reference: ${MOC_AI_ELASTOMERS.join(", ")}. Same rule — recommend outside this list only
when justified, and explain why.

Seal: choose exactly one of "${MOC_AI_SEAL_TYPES[0]}" or "${MOC_AI_SEAL_TYPES[1]}". Mechanical
seal for corrosive (high/very high), hazardous/toxic/flammable, or high-temperature (>100°C) duty
— near-zero leakage. Gland packing for mild, non-hazardous, general/utility duty where minor
leakage is tolerable and cost matters.

Not all process data that could refine this decision has been collected yet (chemical
composition, differential pressure, particle abrasiveness/corrosiveness ratings, required pump
speed, duty cycle, applicable industry standard) — use only the data given below plus standard
PCP engineering judgment, and note in the summary if a missing datum would materially change the
recommendation.

Respond with:
- The 8 component picks (bearingHousing, bearingPlate, tieRod, nutBolt, pumpHousing, rotor, shaft,
  statorRubber) — each a short material name, e.g. "SS316".
- sealRecommendation — exactly one of the two seal options above.
- sealRationale — 1-2 sentences on why that seal type, specific to this duty.
- summary — a detailed, well-organized engineering report (3-5 short paragraphs) covering: the
  overall metallurgy/elastomer logic for this duty (why these picks, grouped by wetted vs.
  structural parts rather than repeating every component one-by-one), the key process drivers
  (corrosivity, temperature, hazard, cost), and any caveats from missing process data. Write it as
  something a sales engineer could hand to a customer, not just a list.
- alternatives — 1-3 concrete alternative material/elastomer combinations worth considering (e.g.
  a lower-cost fallback, or a more resistant upgrade path), each with a one-line note on the
  trade-off (cost vs. durability vs. availability). Plain text, not JSON.`;

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
    summary: { type: "string" },
    alternatives: { type: "string" },
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
    line("Fluid name / application", context.media) +
    line("pH", context.ph) +
    line("Temperature", context.temperatureC, " °C") +
    line("Viscosity", context.viscosityCp, " cP") +
    line("Specific gravity", context.sg) +
    line("Flow rate", context.capacity, ` ${context.capacityUnit ?? ""}`.trimEnd()) +
    line("Solids concentration", context.solidPct, "%") +
    line(
      "Particle size",
      context.solidSize,
      context.solidType ? ` mm (${context.solidType})` : " mm",
    );

  const prompt =
    `${PROMPT_INSTRUCTIONS}\n\nProcess data:\n${processData || "(none provided yet)"}`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 3072,
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
