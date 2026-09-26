"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import PageHeader from "../../components/ui/PageHeader";
import QuotationPanel from "./QuotationPanel";
import {
  BOI_ITEMS,
  type BoiKey,
  type CommercialPrices,
  type CommercialReference,
  type CommercialSummary,
  type CommercialTag,
  MAX_OTHER_ITEMS,
  boiTotal,
  formatInr,
  parsePrice,
  subTotal,
  unitTotal,
} from "../../lib/commercial";
import { getCommercialSummary, saveCommercialPrices } from "../../services/commercialService";

// Commercial Summary (pricing v1, manual). Every tag of one enquiry on one
// page: Pump & Accessories + BOI items typed in per unit, quantity pulled from
// the wizard's Pump Model & Qty step, sub-total = unit price × qty, grand total
// = sum of sub-totals. The wizard's motor / gearbox pick is shown beside those
// rows as a reference the user can copy in — never applied on its own.

type PriceKey = "paPrice" | BoiKey;

/** Form state keeps the raw text the user typed; parsed only for totals/save. */
type Draft = {
  paPrice: string;
  others: { name: string; price: string }[];
  remarks: string;
} & Record<BoiKey, string>;

const priceText = (n: number | null) => (n === null ? "" : String(n));

const toDraft = (p: CommercialPrices): Draft => ({
  paPrice: priceText(p.paPrice),
  motorPrice: priceText(p.motorPrice),
  gearboxPrice: priceText(p.gearboxPrice),
  strainerPrice: priceText(p.strainerPrice),
  prvPrice: priceText(p.prvPrice),
  drpPrice: priceText(p.drpPrice),
  others: p.others.map((o) => ({ name: o.name, price: priceText(o.price) })),
  remarks: p.remarks,
});

/** Parsed prices for the live totals — an invalid entry counts as 0 here and
 *  is flagged on its field instead. */
const parseDraft = (d: Draft): CommercialPrices => {
  const val = (s: string) => parsePrice(s) ?? null;
  return {
    paPrice: val(d.paPrice),
    motorPrice: val(d.motorPrice),
    gearboxPrice: val(d.gearboxPrice),
    strainerPrice: val(d.strainerPrice),
    prvPrice: val(d.prvPrice),
    drpPrice: val(d.drpPrice),
    others: d.others.map((o) => ({ name: o.name.trim(), price: val(o.price) })),
    remarks: d.remarks.trim(),
  };
};

/** Field-level problems that would make the save fail. */
const draftErrors = (d: Draft): Record<string, string> => {
  const errs: Record<string, string> = {};
  const bad = (s: string) => parsePrice(s) === undefined;
  (["paPrice", ...BOI_ITEMS.map((b) => b.key)] as PriceKey[]).forEach((k) => {
    if (bad(d[k])) errs[k] = "Enter a valid amount.";
  });
  d.others.forEach((o, i) => {
    if (bad(o.price)) errs[`other-${i}`] = "Enter a valid amount.";
    else if (!o.name.trim() && o.price.trim()) errs[`other-${i}`] = "Name this item.";
  });
  return errs;
};

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

const inputCls =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-fg outline-none transition placeholder:text-fg-4 focus:border-accent focus:ring-2 focus:ring-accent-soft";
const moneyCls = `${inputCls} text-right font-mono`;
const btnSm =
  "inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-fg-2 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimarySm =
  "inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export default function CommercialSummaryPage() {
  const projectId = useSearchParams().get("projectId") ?? "";
  const [data, setData] = useState<CommercialSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Saved (server) and working copies per tag.
  const [saved, setSaved] = useState<Record<string, Draft>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState<Record<string, boolean>>({});
  const [justSaved, setJustSaved] = useState<Record<string, boolean>>({});
  // Bumped after each price save so the quotation's live version refreshes.
  const [pricesVersion, setPricesVersion] = useState(0);

  const load = useCallback(async () => {
    if (!projectId) {
      setLoadError("No enquiry selected. Open the Commercial Summary from the Enquiries page.");
      return;
    }
    setLoadError(null);
    try {
      const res = await getCommercialSummary(projectId);
      const d = Object.fromEntries(res.tags.map((t) => [t.tagId, toDraft(t.prices)]));
      setData(res);
      setSaved(d);
      setDrafts(d);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setLoadError(status === 404 ? "This enquiry no longer exists." : "Couldn't load the Commercial Summary. Try again.");
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const dirtyIds = useMemo(
    () => Object.keys(drafts).filter((id) => saved[id] && !sameDraft(drafts[id], saved[id])),
    [drafts, saved],
  );

  // Warn before leaving with unsaved prices.
  useEffect(() => {
    if (dirtyIds.length === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyIds.length]);

  const updateDraft = (tagId: string, patch: Partial<Draft>) => {
    setDrafts((m) => ({ ...m, [tagId]: { ...m[tagId], ...patch } }));
    setJustSaved((m) => ({ ...m, [tagId]: false }));
  };

  const saveTag = async (tagId: string): Promise<boolean> => {
    const draft = drafts[tagId];
    if (Object.keys(draftErrors(draft)).length > 0) {
      setShowErrors((m) => ({ ...m, [tagId]: true }));
      return false;
    }
    setSaving((m) => ({ ...m, [tagId]: true }));
    setSaveError((m) => ({ ...m, [tagId]: "" }));
    try {
      const prices = parseDraft(draft);
      // Drop rows the user added but never filled.
      prices.others = prices.others.filter((o) => o.name || o.price !== null);
      await saveCommercialPrices(tagId, prices);
      const clean = toDraft(prices);
      setSaved((m) => ({ ...m, [tagId]: clean }));
      setDrafts((m) => ({ ...m, [tagId]: clean }));
      setShowErrors((m) => ({ ...m, [tagId]: false }));
      setJustSaved((m) => ({ ...m, [tagId]: true }));
      setPricesVersion((n) => n + 1);
      return true;
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSaveError((m) => ({ ...m, [tagId]: msg || "Couldn't save. Try again." }));
      return false;
    } finally {
      setSaving((m) => ({ ...m, [tagId]: false }));
    }
  };

  const saveAll = async () => {
    for (const id of dirtyIds) await saveTag(id);
  };

  const rows = useMemo(
    () =>
      (data?.tags ?? []).map((t) => {
        const p = drafts[t.tagId] ? parseDraft(drafts[t.tagId]) : t.prices;
        return { tag: t, prices: p, unit: unitTotal(p), sub: subTotal(p, t.quantity) };
      }),
    [data, drafts],
  );
  const grand = rows.reduce((s, r) => s + r.sub, 0);
  const missingQty = rows.filter((r) => r.tag.quantity === null).length;

  const project = data?.project;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-5 sm:px-6">
      <PageHeader
        icon={<RupeeIcon />}
        title="Commercial Summary"
        subtitle={
          project
            ? [project.code, project.name, project.customerName].filter(Boolean).join(" · ")
            : "Pump & Accessories and BOI prices for every tag of the enquiry"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {dirtyIds.length > 0 && (
              <span className="text-[12.5px] font-medium text-warn">
                {dirtyIds.length} tag{dirtyIds.length === 1 ? "" : "s"} with unsaved changes
              </span>
            )}
            <button
              type="button"
              className={btnPrimarySm}
              onClick={saveAll}
              disabled={dirtyIds.length === 0 || dirtyIds.some((id) => saving[id])}
            >
              Save all
            </button>
            <Link href="/projects" className={btnSm}>
              Back to Enquiries
            </Link>
          </div>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-line bg-paper p-5 text-[13.5px] text-neg">
          {loadError}{" "}
          {projectId && (
            <button type="button" className="font-semibold text-accent underline" onClick={load}>
              Retry
            </button>
          )}
        </div>
      )}

      {!data && !loadError && (
        <div className="rounded-xl border border-line bg-paper p-8 text-center text-[13.5px] text-fg-3">
          Loading Commercial Summary…
        </div>
      )}

      {data && data.tags.length === 0 && (
        <div className="rounded-xl border border-line bg-paper p-8 text-center text-[13.5px] text-fg-3">
          This enquiry has no tags yet.
        </div>
      )}

      {data && data.tags.length > 0 && (
        <>
          <QuotationPanel projectId={projectId} hasUnsavedPrices={dirtyIds.length > 0} pricesVersion={pricesVersion} />

          {/* Summary across all tags */}
          <section className="rounded-xl border border-line bg-paper">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="text-[14px] font-semibold text-fg">Summary</h2>
              <span className="text-[12px] text-fg-3">All prices in INR, per unit unless marked</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11.5px] font-semibold tracking-[0.06em] text-fg-3 uppercase">
                    <th className="px-4 py-2.5">Tag</th>
                    <th className="px-4 py-2.5">Pump Model</th>
                    <th className="px-4 py-2.5 text-right">P&amp;A</th>
                    <th className="px-4 py-2.5 text-right">BOI Items</th>
                    <th className="px-4 py-2.5 text-right">Unit Price</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Sub-total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ tag, prices, unit, sub }) => (
                    <tr key={tag.tagId} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-2.5">
                        <a href={`#tag-${tag.tagId}`} className="font-semibold text-accent hover:underline">
                          {tag.tagName}
                        </a>
                        {dirtyIds.includes(tag.tagId) && (
                          <span className="ml-2 text-[11px] font-medium text-warn">unsaved</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-fg-2">
                        {tag.productCode ?? tag.model ?? "—"}
                        {tag.productCode && tag.model && (
                          <span className="block text-[11.5px] text-fg-3">{tag.model}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatInr(prices.paPrice)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatInr(boiTotal(prices))}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatInr(unit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {tag.quantity ?? <span className="text-neg">not set</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-fg">{formatInr(sub)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line-strong bg-sunk">
                    <td colSpan={6} className="px-4 py-3 text-right text-[13px] font-semibold text-fg">
                      Grand Total
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[15px] font-bold text-fg">{formatInr(grand)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {missingQty > 0 && (
              <p className="border-t border-line px-4 py-2.5 text-[12px] text-neg">
                {missingQty} tag{missingQty === 1 ? " has" : "s have"} no quantity, so{" "}
                {missingQty === 1 ? "it counts" : "they count"} as 0. Set Quantity on the tag&apos;s Pump Model &amp; Qty
                step.
              </p>
            )}
          </section>

          {rows.map(({ tag, prices, unit, sub }) => (
            <TagCard
              key={tag.tagId}
              tag={tag}
              draft={drafts[tag.tagId]}
              prices={prices}
              unit={unit}
              sub={sub}
              dirty={dirtyIds.includes(tag.tagId)}
              saving={!!saving[tag.tagId]}
              justSaved={!!justSaved[tag.tagId]}
              error={saveError[tag.tagId] ?? ""}
              errors={showErrors[tag.tagId] ? draftErrors(drafts[tag.tagId]) : {}}
              onChange={(patch) => updateDraft(tag.tagId, patch)}
              onSave={() => saveTag(tag.tagId)}
              onReset={() => {
                setDrafts((m) => ({ ...m, [tag.tagId]: saved[tag.tagId] }));
                setShowErrors((m) => ({ ...m, [tag.tagId]: false }));
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

function TagCard({
  tag,
  draft,
  prices,
  unit,
  sub,
  dirty,
  saving,
  justSaved,
  error,
  errors,
  onChange,
  onSave,
  onReset,
}: {
  tag: CommercialTag;
  draft: Draft;
  prices: CommercialPrices;
  unit: number;
  sub: number;
  dirty: boolean;
  saving: boolean;
  justSaved: boolean;
  error: string;
  errors: Record<string, string>;
  onChange: (patch: Partial<Draft>) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const refs: Partial<Record<BoiKey, CommercialReference | null>> = {
    motorPrice: tag.motorRef,
    gearboxPrice: tag.gearboxRef,
  };
  const setOther = (i: number, patch: Partial<{ name: string; price: string }>) =>
    onChange({ others: draft.others.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  return (
    <section id={`tag-${tag.tagId}`} className="scroll-mt-4 rounded-xl border border-line bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-fg">
            {tag.tagName}
            <span className="ml-2 text-[13px] font-normal text-fg-3">{tag.model ?? "No pump selected"}</span>
          </h2>
          <p className="mt-0.5 text-[12px] text-fg-3">
            {[tag.media, tag.driveSystem, tag.status].filter(Boolean).join(" · ")}
            {tag.model && !tag.modelConfirmed && <span className="ml-1 text-warn">· model not confirmed</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {justSaved && !dirty && <span className="text-[12px] font-medium text-pos">Saved</span>}
          {dirty && (
            <button type="button" className={btnSm} onClick={onReset} disabled={saving}>
              Discard
            </button>
          )}
          <button type="button" className={btnPrimarySm} onClick={onSave} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 p-4 lg:grid-cols-[1fr_280px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Pump & Accessories */}
          <div>
            <h3 className="mb-2 text-[11.5px] font-semibold tracking-[0.09em] text-fg-3 uppercase">
              Pump &amp; Accessories
            </h3>
            <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_200px]">
              <p className="pt-2 text-[13px] text-fg-2">
                {tag.productCode ?? tag.model ?? "Pump"} with accessories
                {!tag.productCode && (
                  <span className="block text-[11.5px] text-warn">Product code not picked on the Pump Model &amp; Qty step</span>
                )}
              </p>
              <MoneyInput
                value={draft.paPrice}
                error={errors.paPrice}
                onChange={(v) => onChange({ paPrice: v })}
                label="Pump & Accessories price per unit"
              />
            </div>
          </div>

          {/* BOI items */}
          <div>
            <h3 className="mb-2 text-[11.5px] font-semibold tracking-[0.09em] text-fg-3 uppercase">
              BOI Items (bought-out)
            </h3>
            <div className="flex flex-col divide-y divide-line rounded-lg border border-line">
              {BOI_ITEMS.map((item) => {
                const ref = refs[item.key];
                return (
                  <div
                    key={item.key}
                    className="grid grid-cols-1 items-start gap-2 px-3 py-2.5 sm:grid-cols-[110px_1fr_200px]"
                  >
                    <span className="pt-2 text-[13px] font-semibold text-fg">{item.label}</span>
                    <div className="min-w-0 pt-1 text-[12px] text-fg-3">
                      {ref ? (
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-fg-2">{ref.label}</span>
                          {!ref.confirmed && <span className="text-warn">(not confirmed)</span>}
                          {ref.price !== null && (
                            <button
                              type="button"
                              className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11.5px] text-accent hover:border-accent"
                              onClick={() => onChange({ [item.key]: String(ref.price) } as Partial<Draft>)}
                              title="Copy the master price from the wizard into this field"
                            >
                              Use {formatInr(ref.price)}
                            </button>
                          )}
                        </span>
                      ) : item.key === "motorPrice" || item.key === "gearboxPrice" ? (
                        <span className="pt-1 inline-block">Not selected in the wizard</span>
                      ) : null}
                    </div>
                    <MoneyInput
                      value={draft[item.key]}
                      error={errors[item.key]}
                      onChange={(v) => onChange({ [item.key]: v } as Partial<Draft>)}
                      label={`${item.label} price per unit`}
                    />
                  </div>
                );
              })}

              {draft.others.map((o, i) => (
                <div key={i} className="grid grid-cols-1 items-start gap-2 px-3 py-2.5 sm:grid-cols-[110px_1fr_200px]">
                  <span className="pt-2 text-[13px] font-semibold text-fg">Other</span>
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      placeholder="Item name, e.g. Coupling guard"
                      value={o.name}
                      maxLength={100}
                      onChange={(e) => setOther(i, { name: e.target.value })}
                      aria-label="Other item name"
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-md px-2 py-1.5 text-[12px] font-semibold text-neg hover:bg-[var(--neg-soft)]"
                      onClick={() => onChange({ others: draft.others.filter((_, j) => j !== i) })}
                      aria-label="Remove this item"
                    >
                      Remove
                    </button>
                  </div>
                  <MoneyInput
                    value={o.price}
                    error={errors[`other-${i}`]}
                    onChange={(v) => setOther(i, { price: v })}
                    label="Other item price per unit"
                  />
                </div>
              ))}

              <div className="px-3 py-2">
                <button
                  type="button"
                  className="text-[12.5px] font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:text-fg-4 disabled:no-underline"
                  onClick={() => onChange({ others: [...draft.others, { name: "", price: "" }] })}
                  disabled={draft.others.length >= MAX_OTHER_ITEMS}
                >
                  + Add other item
                </button>
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold tracking-[0.09em] text-fg-3 uppercase">Remarks</span>
            <textarea
              className={`${inputCls} min-h-[64px] resize-y`}
              value={draft.remarks}
              maxLength={2000}
              placeholder="Optional notes on these prices"
              onChange={(e) => onChange({ remarks: e.target.value })}
            />
          </label>

          {error && <p className="text-[12.5px] text-neg">{error}</p>}
          {tag.updatedAt && (
            <p className="text-[11.5px] text-fg-4">
              Last saved {new Date(tag.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              {tag.updatedByName ? ` by ${tag.updatedByName}` : ""}
            </p>
          )}
        </div>

        {/* Totals */}
        <aside className="flex h-fit flex-col gap-2 rounded-lg border border-line bg-sunk p-4 text-[13px]">
          <TotalRow label="Pump & Accessories" value={formatInr(prices.paPrice ?? 0)} />
          <TotalRow label="BOI items" value={formatInr(boiTotal(prices))} />
          <div className="my-1 border-t border-line" />
          <TotalRow label="Unit price" value={formatInr(unit)} strong />
          <TotalRow
            label="Quantity"
            value={tag.quantity === null ? "not set" : `× ${tag.quantity}`}
            warn={tag.quantity === null}
          />
          <div className="my-1 border-t border-line-strong" />
          <TotalRow label="Sub-total" value={formatInr(sub)} big />
          <p className="mt-1 text-[11.5px] text-fg-3">Quantity comes from the Pump Model & Qty step in the pump selection.</p>
        </aside>
      </div>
    </section>
  );
}

function MoneyInput({
  value,
  error,
  onChange,
  label,
}: {
  value: string;
  error?: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-fg-3">₹</span>
        <input
          className={`${moneyCls} pl-7 ${error ? "border-neg" : ""}`}
          inputMode="decimal"
          placeholder="0"
          value={value}
          aria-label={label}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {error && <span className="text-[11.5px] text-neg">{error}</span>}
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong,
  big,
  warn,
}: {
  label: string;
  value: string;
  strong?: boolean;
  big?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={big || strong ? "font-semibold text-fg" : "text-fg-2"}>{label}</span>
      <span
        className={`font-mono ${big ? "text-[16px] font-bold text-fg" : strong ? "font-semibold text-fg" : "text-fg-2"} ${
          warn ? "text-neg" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

const RupeeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h12M6 9h12M14.5 20 7 13h2.5a4.5 4.5 0 0 0 0-9" />
  </svg>
);
