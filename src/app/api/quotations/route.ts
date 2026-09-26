import { eq } from "drizzle-orm";

import { error, isUniqueViolation, json } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { tryDecodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, quotation, quotationVersion } from "@/lib/db/schema";
import { finYearOf, quotationNumber } from "@/lib/commercial";
import { buildSnapshot, loadQuotation, suggestedTsm, tsmById } from "@/lib/quotation-server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Today in India (the quotation date), yyyy-mm-dd. */
const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

// GET /api/quotations?projectId=… — the enquiry's quotation (or null), plus
// the client's rep in sales (`clientTsm`). The TSM is LOCKED to that rep; only
// when the client has none (or no client code) is it picked by hand.
export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  if (!UUID.test(projectId)) return error("'projectId' query param is required", 400);
  const [p] = await db
    .select({ clientCode: projects.clientCode })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!p) return error("Enquiry not found", 404);
  const [q, clientTsm] = await Promise.all([
    loadQuotation(projectId),
    suggestedTsm(p.clientCode).catch(() => null),
  ]);
  return json({ quotation: q, clientTsm });
}

// POST /api/quotations {projectId, tsmRepId?} — creates the enquiry's
// quotation: date = today, FY from it, region = the TSM's initials, internal
// V0 (with a snapshot of the prices), client version not sent yet. Serial left
// empty (on hold). TSM = the client's rep in sales (tsmRepId is ignored then);
// tsmRepId is only used when the client has no rep.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }
  const projectId = String(body.projectId ?? "");
  if (!UUID.test(projectId)) return error("'projectId' is required", 400);

  const [p] = await db
    .select({ code: projects.projectCode, name: projects.name, clientCode: projects.clientCode })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!p) return error("Enquiry not found", 404);

  let tsm;
  try {
    tsm = await suggestedTsm(p.clientCode);
  } catch {
    return error("Couldn't read the client's rep from the sales portal. Try again.", 502);
  }
  if (!tsm) {
    const tsmRepId = Number(body.tsmRepId);
    if (!Number.isInteger(tsmRepId)) return error("This client has no rep in sales — select the TSM.", 400);
    tsm = await tsmById(tsmRepId);
    if (!tsm) return error("That TSM was not found in the sales user list.", 400);
  }

  const claims = tryDecodeToken(req);
  const createdBy = claims?.sub && UUID.test(claims.sub) ? claims.sub : null;
  const quoteDate = todayIst();
  const snapshot = await buildSnapshot(projectId);

  try {
    const created = await db.transaction(async (tx) => {
      const [q] = await tx
        .insert(quotation)
        .values({
          projectId,
          productType: "PCP",
          quoteDate,
          finYear: finYearOf(quoteDate),
          regionCode: tsm.initials,
          tsmRepId: tsm.id,
          tsmName: tsm.name,
          tsmInitials: tsm.initials,
          tsmZone: tsm.zone,
          clientCode: p.clientCode,
          clientName: p.name,
          internalVersion: 0,
          createdBy,
        })
        .returning();
      await tx.insert(quotationVersion).values({
        quotationId: q.id,
        track: "internal",
        version: 0,
        reason: "Quotation created",
        tsmName: tsm.name,
        tsmInitials: tsm.initials,
        snapshot,
        createdBy,
      });
      return q;
    });
    await logAudit(req, {
      action: "quotation.create",
      entity: "quotation",
      entityId: created.id,
      detail: `Created quotation ${quotationNumber(created)} for ${p.code} (TSM ${tsm.name}) — internal V0`,
    });
  } catch (err) {
    if (isUniqueViolation(err)) return error("This enquiry already has a quotation.", 409);
    throw err;
  }
  return json(await loadQuotation(projectId), 201);
}
