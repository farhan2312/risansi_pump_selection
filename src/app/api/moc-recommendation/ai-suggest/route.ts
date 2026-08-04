import { error, json } from "@/lib/api";
import { getMocAiSuggestion } from "@/lib/moc-ai-suggestion";

export const dynamic = "force-dynamic";

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

// AI-assisted, per-component MOC/elastomer/sealing suggestion — advisory
// only, scoped to whatever process data the wizard has actually collected so
// far. Returns 204 (not 500) when the AI path is unavailable (no API key,
// blocked response, request failure) so the frontend can show a plain
// "unavailable" state rather than treating it as an error.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const media = str(body.media);
  if (!media) return error("'media' is required", 400);

  const suggestion = await getMocAiSuggestion({
    media,
    ph: str(body.ph),
    temperatureC: str(body.temperatureC),
    viscosityCp: str(body.viscosityCp),
    sg: str(body.sg),
    capacity: str(body.capacity),
    capacityUnit: str(body.capacityUnit),
    solidPct: str(body.solidPct),
    solidSize: str(body.solidSize),
    solidType: str(body.solidType),
  });

  if (!suggestion) {
    return new Response(null, { status: 204 });
  }
  return json(suggestion);
}
