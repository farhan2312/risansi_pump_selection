/**
 * AI-assisted, per-component MOC/elastomer/sealing suggestion for the MOC &
 * Elastomer wizard step. Advisory only, clearly badged as an AI suggestion in
 * the UI, never a substitute for the manual selectors — and never throws: an
 * unset API key, a blocked response, or any request failure just returns
 * null and the caller falls back to "unavailable".
 *
 * Two interchangeable providers, picked per-request from the MOC form:
 *   - "gemini": Google's Gemini API (free tier via Google AI Studio) over
 *     plain fetch — no SDK dependency. Requires GEMINI_API_KEY. Structured
 *     output via generationConfig.responseSchema.
 *   - "anthropic": Claude Haiku 4.5 via @anthropic-ai/sdk. Requires
 *     ANTHROPIC_API_KEY. Structured output via a forced tool call (Claude has
 *     no equivalent of Gemini's responseSchema, but a single forced tool use
 *     gives the same reliability — the SDK hands back already-parsed JSON in
 *     the tool_use block's `input`, no manual JSON.parse needed).
 *
 * Component breakdown is per the user's spec sheet: non-wettable components
 * (Bearing Housing, Base Plate, Tie Rod, Nut & Bolt) and wettable-casting
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

/** The two selectable LLM providers for the MOC AI recommendation — surfaced
 * as a dropdown next to the "Generate AI Recommendation" button. */
export const MOC_AI_PROVIDERS = ["gemini", "anthropic"] as const;
export type MocAiProvider = (typeof MOC_AI_PROVIDERS)[number];

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
  basePlate: string;
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

const REQUIRED_FIELDS: (keyof MocComponentSuggestions)[] = [
  "bearingHousing", "basePlate", "tieRod", "nutBolt",
  "pumpHousing", "rotor", "shaft", "statorRubber",
  "sealRecommendation", "sealRationale", "summary", "alternatives",
];

// Shared JSON-Schema property map — both Gemini's responseSchema and
// Anthropic's tool input_schema are JSON Schema, so the same shape drives
// both providers' structured output.
const SCHEMA_PROPERTIES = {
  bearingHousing: { type: "string" },
  basePlate: { type: "string" },
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
} as const;

// Kept short on purpose (token cost) — media/head/capacity are the 3
// parameters that most determine the answer, so they're stated directly in
// the instruction sentence; everything else goes in the compact "Other data"
// block below, only when actually provided.
function buildPrompt(context: MocAiContext, processData: string): string {
  const head = context.head ? `${context.head} ${context.headUnit || "MWC"}` : "n/a";
  const capacity = context.capacity
    ? `${context.capacity} ${context.capacityUnit ?? ""}`.trim()
    : "n/a";
  // Enumerate which of the ancillary parameters the user did NOT enter, so
  // the model knows to fill those with typical values for the media (and
  // label them (estimated)) in the summary's Operating Parameters section.
  const missing: string[] = [];
  if (!context.ph) missing.push("pH");
  if (!context.temperatureC) missing.push("Temperature");
  if (!context.viscosityCp) missing.push("Viscosity");
  const missingClause =
    missing.length > 0
      ? `Not provided: ${missing.join(", ")}. In the summary's Operating Parameters section, include a typical value for each missing one for this media, labeled (estimated). `
      : "";
  return (
    `PCP pump. Media: ${context.media}. Head: ${head}. Capacity: ${capacity}.\n` +
    `Recommend lowest-cost reliable MOC (per component), stator elastomer, shaft seal. Prefer most economical: ${MOC_AI_MATERIALS.join(", ")}.\n` +
    `${missingClause}` +
    `summary: detailed markdown engineering note — start with an Operating Parameters section listing Media, Head, Capacity, pH, Temperature, Viscosity (with (estimated) for any not provided); then use ## headers, **bold**, bullet lists AND | pipe tables |, e.g. a Component/Material/Why table and a Mechanical Seal vs Gland Packing comparison table. ` +
    `alternatives: markdown with a | pipe table | of alternative materials and trade-offs. ` +
    `IMPORTANT: use plain ASCII only. No emoji, no unicode symbols (avoid these: check-mark, cross, warning-triangle, approx-symbol, arrow, bullet-dot). Use "OK" / "X" / "!" / "~" / "->" / "-" instead.` +
    (processData ? `\nOther data:\n${processData}` : "")
  );
}

function line(label: string, value: string | null, unit = ""): string {
  return value && value.trim() !== "" ? `${label}: ${value}${unit}\n` : "";
}

function buildProcessData(context: MocAiContext): string {
  return (
    line("pH", context.ph) +
    line("Temperature", context.temperatureC, " °C") +
    line("Viscosity", context.viscosityCp, " cP") +
    line("SG", context.sg) +
    line("Solids", context.solidPct, "%") +
    line(
      "Particle size",
      context.solidSize,
      context.solidType ? ` mm (${context.solidType})` : " mm",
    )
  );
}

function coerceSuggestions(parsed: Partial<Record<string, unknown>>): MocComponentSuggestions | null {
  if (REQUIRED_FIELDS.some((k) => typeof parsed[k] !== "string")) {
    return null;
  }
  const get = (k: keyof MocComponentSuggestions) => (parsed[k] as string).trim();
  return {
    bearingHousing: get("bearingHousing"),
    basePlate: get("basePlate"),
    tieRod: get("tieRod"),
    nutBolt: get("nutBolt"),
    pumpHousing: get("pumpHousing"),
    rotor: get("rotor"),
    shaft: get("shaft"),
    statorRubber: get("statorRubber"),
    sealRecommendation: get("sealRecommendation"),
    sealRationale: get("sealRationale"),
    summary: get("summary"),
    alternatives: get("alternatives"),
  };
}

// --- Gemini provider ---------------------------------------------------

// "gemini-2.0-flash" returns 429 RESOURCE_EXHAUSTED (limit: 0) on the free
// tier for this key's project — "gemini-flash-latest" is the model that's
// actually available under the free tier. It's a "thinking" model (spends
// tokens on internal reasoning before the final answer, reflected as
// thoughtsTokenCount in the response), so maxOutputTokens below is set well
// above the visible JSON's size to leave room for that.
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function getMocAiSuggestionGemini(
  context: MocAiContext,
): Promise<MocComponentSuggestions | null> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey || apiKey.startsWith("REPLACE_")) {
    return null;
  }

  const prompt = buildPrompt(context, buildProcessData(context));

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Auth via header, NOT a ?key= query param — keeps the API key out of
        // the request URL so it can't leak into fetch error messages, server
        // logs, proxies, or browser/CDN caches.
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: SCHEMA_PROPERTIES,
            required: REQUIRED_FIELDS,
          },
          maxOutputTokens: 4500,
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

    return coerceSuggestions(JSON.parse(text));
  } catch (err) {
    // Log only the message, never the raw error — its `cause` chain can carry
    // request/connection details we don't want in server logs.
    console.error("Gemini MOC-suggestion request failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// --- Anthropic provider (Claude Haiku 4.5) ------------------------------

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const MOC_TOOL_NAME = "moc_recommendation";

async function getMocAiSuggestionAnthropic(
  context: MocAiContext,
): Promise<MocComponentSuggestions | null> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey || apiKey.startsWith("REPLACE_")) {
    return null;
  }

  let Anthropic: typeof import("@anthropic-ai/sdk").default;
  try {
    Anthropic = (await import("@anthropic-ai/sdk")).default;
  } catch {
    console.warn("@anthropic-ai/sdk not installed; skipping Anthropic MOC suggestion");
    return null;
  }

  const prompt = buildPrompt(context, buildProcessData(context));

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2500,
      tools: [
        {
          name: MOC_TOOL_NAME,
          description:
            "Records the per-component MOC/elastomer/seal recommendation for a progressive cavity pump.",
          input_schema: {
            type: "object",
            properties: SCHEMA_PROPERTIES,
            required: REQUIRED_FIELDS,
          },
        },
      ],
      // Force the single tool call rather than letting Claude reply in free
      // text — this is Claude's equivalent of Gemini's responseSchema: the
      // SDK hands back already-parsed JSON in the tool_use block, so there's
      // no free-text JSON to fish out of a chat-style reply.
      tool_choice: { type: "tool", name: MOC_TOOL_NAME },
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") {
      console.warn("Anthropic MOC-suggestion request was refused");
      return null;
    }

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;

    return coerceSuggestions(toolUse.input as Partial<Record<string, unknown>>);
  } catch (err) {
    console.error("Anthropic MOC-suggestion request failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// --- Dispatch ------------------------------------------------------------

export async function getMocAiSuggestion(
  context: MocAiContext,
  provider: MocAiProvider = "gemini",
): Promise<MocComponentSuggestions | null> {
  return provider === "anthropic"
    ? getMocAiSuggestionAnthropic(context)
    : getMocAiSuggestionGemini(context);
}
