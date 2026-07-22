import { error } from "@/lib/api";

export const dynamic = "force-dynamic";

// media_types doesn't exist in the DB yet (it was this app's own table, not
// sourced from a spreadsheet — dropped from schema.ts along with the other
// not-yet-built masters). The frontend (MediaSelect.tsx) already handles a
// failed fetch gracefully, so return a clear error rather than silently
// pretending an empty list is the real state.
export async function GET() {
  return error("Media types aren't available yet — the media_types table hasn't been built.", 501);
}

export async function POST() {
  return error("Media types aren't available yet — the media_types table hasn't been built.", 501);
}
