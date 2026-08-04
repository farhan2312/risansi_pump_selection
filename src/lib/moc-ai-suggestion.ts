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
 * Component breakdown and material/elastomer option lists are per the user's
 * spec sheet: non-wettable components (Bearing Housing, Bearing Plate, Tie
 * Rod, Nut & Bolt) and wettable-casting components (Pump Housing, Rotor,
 * Shaft) both draw from the same 10-material list; the stator rubber draws
 * from a separate 7-item elastomer list. The engineering prompt itself is
 * the user's own wording (economical-first PCP MOC selection), scoped to
 * only the process data this wizard actually collects today — more
 * attributes (chemical composition, differential pressure, abrasiveness/
 * corrosiveness ratings, required speed, duty cycle, industry standard) are
 * intentionally left out until the form collects them.
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
  rationale: string;
}

// "gemini-2.0-flash" returns 429 RESOURCE_EXHAUSTED (limit: 0) on the free
// tier for this key's project — "gemini-flash-latest" is the model that's
// actually available under the free tier. It's a "thinking" model (spends
// tokens on internal reasoning before the final answer, reflected as
// thoughtsTokenCount in the response), so maxOutputTokens below is set well
// above the visible JSON's size to leave room for that.
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROMPT_INSTRUCTIONS = `What is the basic material of construction, elastomer, and gland \
packing or mechanical seal recommended — the optimum material of construction (MOC) for a single \
screw (progressive cavity) pump. Please recommend the most economical material that will provide \
reliable service. Avoid unnecessarily expensive materials.

With the process data given below, decide whether economical materials such as cast iron, SS410, \
and SS304 are adequate, or whether more corrosion- or wear-resistant options (e.g., SS316, duplex \
stainless steel, hardened rotors, or specialty elastomers) are justified.`

/*Not all process data that could inform this decision has been collected yet by this form (chemical \
composition, differential pressure, particle abrasiveness/corrosiveness ratings, required pump \
speed, duty cycle, and applicable industry standard are not yet available) — use only the process \
data actually given below, plus standard PCP engineering judgment, and note in your rationale if \
missing data would materially change the recommendation.

You must choose the metal components (bearingHousing, bearingPlate, tieRod, nutBolt, pumpHousing, \
rotor, shaft) ONLY from this material list: ${MOC_AI_MATERIALS.join(", ")}.
You must choose statorRubber ONLY from this elastomer list: ${MOC_AI_ELASTOMERS.join(", ")}.
You must choose sealRecommendation ONLY from: ${MOC_AI_SEAL_TYPES.join(", ")}.`;*/

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    bearingHousing: { type: "string", enum: [...MOC_AI_MATERIALS] },
    bearingPlate: { type: "string", enum: [...MOC_AI_MATERIALS] },
    tieRod: { type: "string", enum: [...MOC_AI_MATERIALS] },
    nutBolt: { type: "string", enum: [...MOC_AI_MATERIALS] },
    pumpHousing: { type: "string", enum: [...MOC_AI_MATERIALS] },
    rotor: { type: "string", enum: [...MOC_AI_MATERIALS] },
    shaft: { type: "string", enum: [...MOC_AI_MATERIALS] },
    statorRubber: { type: "string", enum: [...MOC_AI_ELASTOMERS] },
    sealRecommendation: { type: "string", enum: [...MOC_AI_SEAL_TYPES] },
    rationale: { type: "string" },
  },
  required: [
    "bearingHousing", "bearingPlate", "tieRod", "nutBolt",
    "pumpHousing", "rotor", "shaft", "statorRubber", "sealRecommendation", "rationale",
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
          maxOutputTokens: 2048,
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
      "pumpHousing", "rotor", "shaft", "statorRubber", "sealRecommendation",
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
      rationale: (parsed.rationale ?? "").trim(),
    };
  } catch (err) {
    console.error("Gemini MOC-suggestion request failed", err);
    return null;
  }
}
