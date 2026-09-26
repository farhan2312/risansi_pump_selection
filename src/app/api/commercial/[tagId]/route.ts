import { eq } from "drizzle-orm";

import { error, json } from "@/lib/api";
import { describeTag, logAudit } from "@/lib/audit";
import { tryDecodeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { commercialTagPrice, enquiryTags } from "@/lib/db/schema";
import {
  BOI_ITEMS,
  type CommercialOther,
  type CommercialPrices,
  MAX_OTHER_ITEMS,
  formatInr,
  parsePrice,
} from "@/lib/commercial";

export const dynamic = "force-dynamic";

// PUT /api/commercial/[tagId] — saves one tag's manually entered prices
// (replace-all: the body is the tag's full price set). Audited with the fields
// that actually changed; an unchanged save writes nothing to the trail.

const PRICE_FIELDS = [{ key: "paPrice", label: "Pump & Accessories" }, ...BOI_ITEMS] as const;

const numOrNull = (v: string | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

export async function PUT(req: Request, { params }: { params: Promise<{ tagId: string }> }) {
  const { tagId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tagId)) return error("Invalid tag id", 400);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be JSON", 400);
  }

  const [tag] = await db
    .select({ projectId: enquiryTags.projectId })
    .from(enquiryTags)
    .where(eq(enquiryTags.id, tagId))
    .limit(1);
  if (!tag) return error("Tag not found", 404);

  // --- validate ------------------------------------------------------------
  const next = {} as CommercialPrices;
  for (const f of PRICE_FIELDS) {
    const v = parsePrice(body[f.key]);
    if (v === undefined) return error(`${f.label}: enter a valid amount (0 or more).`, 400);
    next[f.key] = v;
  }
  const rawOthers = Array.isArray(body.others) ? body.others : [];
  if (rawOthers.length > MAX_OTHER_ITEMS) {
    return error(`At most ${MAX_OTHER_ITEMS} other items per tag.`, 400);
  }
  const others: CommercialOther[] = [];
  for (const o of rawOthers) {
    const item = (o ?? {}) as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 100) : "";
    const price = parsePrice(item.price);
    if (price === undefined) return error(`Other item "${name || "unnamed"}": enter a valid amount.`, 400);
    if (!name && price === null) continue; // an empty row the user never filled
    if (!name) return error("Every other item with a price needs a name.", 400);
    others.push({ name, price });
  }
  next.others = others;
  next.remarks = typeof body.remarks === "string" ? body.remarks.trim().slice(0, 2000) : "";

  // --- diff against what's stored, for the audit trail ----------------------
  const [prev] = await db
    .select()
    .from(commercialTagPrice)
    .where(eq(commercialTagPrice.tagId, tagId))
    .limit(1);
  const changes: string[] = [];
  for (const f of PRICE_FIELDS) {
    const before = prev ? numOrNull(prev[f.key]) : null;
    if (before !== next[f.key]) changes.push(`${f.label} ${formatInr(before)} → ${formatInr(next[f.key])}`);
  }
  const othersText = (list: CommercialOther[]) =>
    list.map((o) => `${o.name} ${formatInr(o.price)}`).join(", ") || "none";
  const prevOthers = prev?.others ?? [];
  if (JSON.stringify(prevOthers) !== JSON.stringify(others)) {
    changes.push(`Others ${othersText(prevOthers)} → ${othersText(others)}`);
  }
  if ((prev?.remarks ?? "") !== next.remarks) changes.push("Remarks updated");

  const claims = tryDecodeToken(req);
  const updatedBy = claims?.sub && /^[0-9a-f-]{36}$/i.test(claims.sub) ? claims.sub : null;
  const values = {
    paPrice: next.paPrice?.toString() ?? null,
    motorPrice: next.motorPrice?.toString() ?? null,
    gearboxPrice: next.gearboxPrice?.toString() ?? null,
    strainerPrice: next.strainerPrice?.toString() ?? null,
    prvPrice: next.prvPrice?.toString() ?? null,
    drpPrice: next.drpPrice?.toString() ?? null,
    others,
    remarks: next.remarks || null,
  };

  if (prev && changes.length === 0) return json({ ok: true, changed: false });

  const now = new Date();
  await db
    .insert(commercialTagPrice)
    .values({ projectId: tag.projectId, tagId, ...values, updatedBy, updatedAt: now })
    .onConflictDoUpdate({
      target: commercialTagPrice.tagId,
      set: { ...values, updatedBy, updatedAt: now },
    });

  if (changes.length > 0) {
    const where = (await describeTag(tagId)) ?? "tag";
    await logAudit(req, {
      action: "commercial.update",
      entity: "commercial_tag_price",
      entityId: tagId,
      detail: `Updated commercial prices for ${where}: ${changes.join("; ")}`.slice(0, 2000),
    });
  }
  return json({ ok: true, changed: changes.length > 0 });
}
