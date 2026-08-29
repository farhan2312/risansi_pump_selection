import { eq } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { db } from "@/lib/db";
import { mocSealingInput } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Binary storage for the client-supplied requirements file (image or PDF) that
// the MOC step used to accept as free text. Kept off the generic JSON [table]
// endpoint for the same reason as /document: raw bytes don't belong in that
// contract. Only "moc-sealing" has these columns; other table keys 404.

// Accepted upload types. Matches Claude's own supported image/document media
// types (see Anthropic messages API) so whatever is stored can be forwarded to
// the model as-is without any conversion step.
const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

// Hard cap so a stray upload can't blow the request body or the DB row. Claude
// accepts documents up to ~5 MB base64-encoded; the raw ceiling here is well
// under that.
const MAX_BYTES = 5 * 1024 * 1024;

function guardMocSealing(tableParam: string) {
  return tableParam === "moc-sealing"
    ? null
    : error(`Table "${tableParam}" has no client-requirements file`, 400);
}

// Fetch the stored client-requirements file for direct download / preview.
// Content-Type is served from the row's own mime so an image opens inline and
// a PDF opens in the browser's viewer.
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
      file: mocSealingInput.clientRequirementsFile,
      filename: mocSealingInput.clientRequirementsFilename,
      mime: mocSealingInput.clientRequirementsMime,
    })
    .from(mocSealingInput)
    .where(eq(mocSealingInput.projectId, projectId))
    .limit(1);

  if (!row || !row.file) {
    return error("No client-requirements file for this project", 404);
  }

  const filename = (row.filename || "client-requirements").replace(/"/g, "");
  const mime = row.mime || "application/octet-stream";
  return new Response(new Uint8Array(row.file), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(row.file.length),
    },
  });
}

// Upload/replace the client-requirements file. Body is the raw bytes with the
// filename + mime supplied as query params (same shape as /document, which
// established this pattern). Upserts into moc_sealing_input — the row may not
// exist yet if the MOC step hasn't been opened before.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ table: string }> },
) {
  const { table: tableParam } = await params;
  const denied = guardMocSealing(tableParam);
  if (denied) return denied;

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return error("'projectId' query param is required", 400);

  const filename = url.searchParams.get("filename");
  if (!filename) return error("'filename' query param is required", 400);

  const mime = (url.searchParams.get("mime") || "").toLowerCase();
  if (!ALLOWED_MIMES.has(mime)) {
    return error(
      `Unsupported file type "${mime}". Allowed: ${[...ALLOWED_MIMES].join(", ")}`,
      400,
    );
  }

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0) return error("Request body is empty", 400);
  if (bytes.length > MAX_BYTES) {
    return error(`File exceeds ${MAX_BYTES / (1024 * 1024)} MB limit`, 413);
  }

  const uploadedAt = new Date();
  const result = await db
    .insert(mocSealingInput)
    .values({
      projectId,
      clientRequirementsFile: bytes,
      clientRequirementsFilename: filename,
      clientRequirementsMime: mime,
      clientRequirementsUploadedAt: uploadedAt,
    })
    .onConflictDoUpdate({
      target: mocSealingInput.projectId,
      set: {
        clientRequirementsFile: bytes,
        clientRequirementsFilename: filename,
        clientRequirementsMime: mime,
        clientRequirementsUploadedAt: uploadedAt,
        updatedAt: new Date(),
      },
    })
    .returning({
      clientRequirementsFilename: mocSealingInput.clientRequirementsFilename,
      clientRequirementsMime: mocSealingInput.clientRequirementsMime,
      clientRequirementsUploadedAt: mocSealingInput.clientRequirementsUploadedAt,
    });
  const [row] = result;

  return json(row, 201);
}

// Remove the file. Uses PUT/onConflictDoUpdate with NULLs rather than
// requiring a row-exists check first; matches the upsert style of POST above.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ table: string }> },
) {
  const { table: tableParam } = await params;
  const denied = guardMocSealing(tableParam);
  if (denied) return denied;

  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return error("'projectId' query param is required", 400);

  await db
    .update(mocSealingInput)
    .set({
      clientRequirementsFile: null,
      clientRequirementsFilename: null,
      clientRequirementsMime: null,
      clientRequirementsUploadedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(mocSealingInput.projectId, projectId));

  return json({ ok: true });
}
