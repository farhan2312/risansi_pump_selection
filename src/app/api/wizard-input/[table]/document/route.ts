import { eq } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { db } from "@/lib/db";
import { mocSealingInput } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Binary storage for the generated MOC PDF report — split out of the generic
// [table] route (which is JSON-only) since raw bytes don't belong in that
// contract. Only "moc-sealing" has a document column today; other table
// keys 404 here rather than pretending to support this.
function guardMocSealing(tableParam: string) {
  return tableParam === "moc-sealing" ? null : error(`Table "${tableParam}" has no document`, 400);
}

// Fetches the saved MOC PDF report's raw bytes, for direct download —
// separate from the JSON wizard-input GET so a large binary doesn't have to
// round-trip as base64 inside a JSON payload.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ table: string }> },
) {
  const { table: tableParam } = await params;
  const denied = guardMocSealing(tableParam);
  if (denied) return denied;

  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return error("'projectId' query param is required", 400);

  const [row] = await db
    .select({
      document: mocSealingInput.document,
      documentFilename: mocSealingInput.documentFilename,
    })
    .from(mocSealingInput)
    .where(eq(mocSealingInput.projectId, projectId))
    .limit(1);

  if (!row || !row.document) {
    return error("No saved document for this project", 404);
  }

  const filename = row.documentFilename || "MOC-Report.pdf";
  return new Response(new Uint8Array(row.document), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Content-Length": String(row.document.length),
    },
  });
}

// Uploads the generated MOC PDF report's raw bytes (Content-Type:
// application/pdf body, not JSON) and upserts it into moc_sealing_input —
// the row may not exist yet if this is the very first save for the project.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ table: string }> },
) {
  const { table: tableParam } = await params;
  const denied = guardMocSealing(tableParam);
  if (denied) return denied;

  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return error("'projectId' query param is required", 400);

  const filename = new URL(req.url).searchParams.get("filename") || "MOC-Report.pdf";

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0) return error("Request body is empty", 400);

  const result = await db
    .insert(mocSealingInput)
    .values({
      projectId,
      document: bytes,
      documentFilename: filename,
      documentGeneratedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: mocSealingInput.projectId,
      set: {
        document: bytes,
        documentFilename: filename,
        documentGeneratedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning({
      id: mocSealingInput.id,
      documentFilename: mocSealingInput.documentFilename,
      documentGeneratedAt: mocSealingInput.documentGeneratedAt,
    });
  const [row] = result;

  return json(row, 201);
}
