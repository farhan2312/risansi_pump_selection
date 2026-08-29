import { error, json } from "@/lib/api";
import {
  getMocAiSuggestion,
  isMocAiProviderConfigured,
  MOC_AI_PROVIDERS,
  type MocAiProvider,
} from "@/lib/moc-ai-suggestion";

export const dynamic = "force-dynamic";

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const isProvider = (v: unknown): v is MocAiProvider =>
  typeof v === "string" && (MOC_AI_PROVIDERS as readonly string[]).includes(v);

// AI-assisted, per-component MOC/elastomer/sealing suggestion — advisory
// only, scoped to whatever process data the wizard has actually collected so
// far. Always 200; the body is either the suggestion, or an
// { unavailable } discriminator so the UI can distinguish a missing key
// ("not_configured") from an upstream failure ("failed") instead of showing
// one misleading message for both.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const media = str(body.media);
  if (!media) return error("'media' is required", 400);

  const provider = isProvider(body.provider) ? body.provider : "anthropic";

  // No usable key for this provider — report that distinctly from a call that
  // was attempted and failed, so the UI shows the right message.
  if (!isMocAiProviderConfigured(provider)) {
    return json({ unavailable: "not_configured" });
  }

  const suggestion = await getMocAiSuggestion(
    {
      media,
      pumpType: str(body.pumpType),
      head: str(body.head),
      headUnit: str(body.headUnit),
      ph: str(body.ph),
      temperatureC: str(body.temperatureC),
      viscosityCp: str(body.viscosityCp),
      sg: str(body.sg),
      capacity: str(body.capacity),
      capacityUnit: str(body.capacityUnit),
      solidPct: str(body.solidPct),
      solidSize: str(body.solidSize),
      solidType: str(body.solidType),
      clientRequirements: str(body.clientRequirements),
    },
    provider,
  );

  // Key is configured but the upstream call returned nothing — errored,
  // blocked, or overloaded. That's a transient/request failure, not a
  // configuration problem.
  if (!suggestion) {
    return json({ unavailable: "failed" });
  }
  return json(suggestion);
}
