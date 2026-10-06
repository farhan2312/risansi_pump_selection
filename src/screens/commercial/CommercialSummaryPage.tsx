"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import PageHeader from "../../components/ui/PageHeader";
import QuotationPanel from "./QuotationPanel";
import ClientPriceRefModal from "./ClientPriceRefModal";
import CommercialOfferModal from "./CommercialOfferModal";
import ScopeControls, { ScopeLines } from "./ScopeControls";
import { EMPTY_OFFER_CONFIG, isGearedGroup, type OfferConfig } from "../../lib/commercial-offer";
import { getCommercialOffer, saveCommercialOfferConfig } from "../../services/commercialOfferService";
import PumpQtyStep from "./PumpQtyStep";
import {
  paBasisText,
  paInputsFor,
  paPrice,
  paSuggestion,
  type PaLevel,
  type PaPriceData,
} from "../../lib/pa-price";
import { getPaPriceList } from "../../services/paPriceService";
import {
  BOI_ITEMS,
  DEFAULT_MARKUP_PCT,
  MAX_DISCOUNT_PCT,
  MAX_MARKUP_PCT,
  boiNet,
  otherNet,
  parsePct,
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
  DRIVE_GROUP_LABEL,
  groupsIn,
  type DriveGroup,
  type VfdOption,
  type DrpOption,
} from "../../lib/commercial";
import { getCommercialSummary, saveCommercialPrices, saveCommercialRemarks } from "../../services/commercialService";

// Commercial Summary (pricing v1, manual). Every tag of one enquiry on one
// page: Pump & Accessories + BOI items typed in per unit, quantity pulled from
// step 1 (Pump & Qty, on this page), sub-total = unit price × qty, grand total
// = sum of sub-totals. The wizard's motor / gearbox pick is shown beside those
// rows as a reference the user can copy in — never applied on its own. The
// VFD row lists the BOI Master drives covering the motor kW (one per duty) to
// pick from, for every tag; the DRP row offers the BOI Master
// probe + panel for the tag's model (every tag).

type PriceKey = "paPrice" | BoiKey;

/** Form state keeps the raw text the user typed; parsed only for totals/save. */
type Draft = {
  paPrice: string;
  /** Picked BOI Master VFD ("" = none). */
  vfdModel: string;
  /** Used BOI Master DRP kit ("" = none). */
  drpModel: string;
  /** Used BOI Master mechanical seal ("" = none). */
  mechSealModel: string;
  /** Basis of a used L1–L4 P&A suggestion ("" = typed by hand). */
  paBasis: string;
  others: OtherDraft[];
  /** Per BOI row: vendor discount % and markup % as typed. */
  adjust: Record<BoiKey, PctDraft>;
  remarks: string;
} & Record<BoiKey, string>;

type PctDraft = { discountPct: string; markupPct: string };
type OtherDraft = { name: string; price: string } & PctDraft;

/** A saved % as text; markup falls back to the 25 % default, discount to "". */
const pctDraft = (discountPct: number | null | undefined, markupPct: number | null | undefined): PctDraft => ({
  discountPct: discountPct === null || discountPct === undefined || discountPct === 0 ? "" : String(discountPct),
  markupPct: markupPct === null || markupPct === undefined ? String(DEFAULT_MARKUP_PCT) : String(markupPct),
});
const newOther = (): OtherDraft => ({ name: "", price: "", ...pctDraft(null, null) });

const priceText = (n: number | null) => (n === null ? "" : String(n));

const toDraft = (p: CommercialPrices): Draft => ({
  paPrice: priceText(p.paPrice),
  motorPrice: priceText(p.motorPrice),
  gearboxPrice: priceText(p.gearboxPrice),
  vfdPrice: priceText(p.vfdPrice),
  mechSealPrice: priceText(p.mechSealPrice),
  mechSealModel: p.mechSealModel ?? "",
  vfdModel: p.vfdModel ?? "",
  drpModel: p.drpModel ?? "",
  paBasis: p.paBasis ?? "",
  strainerPrice: priceText(p.strainerPrice),
  prvPrice: priceText(p.prvPrice),
  drpPrice: priceText(p.drpPrice),
  others: p.others.map((o) => ({ name: o.name, price: priceText(o.price), ...pctDraft(o.discountPct, o.markupPct) })),
  adjust: Object.fromEntries(
    BOI_ITEMS.map((it) => [it.key, pctDraft(p.adjust?.[it.key]?.discountPct, p.adjust?.[it.key]?.markupPct)]),
  ) as Record<BoiKey, PctDraft>,
  remarks: p.remarks,
});

/** Parsed prices for the live totals — an invalid entry counts as 0 here and
 *  is flagged on its field instead. */
const parseDraft = (d: Draft): CommercialPrices => {
  const val = (s: string) => parsePrice(s) ?? null;
  const pct = (s: string, max: number) => parsePct(s, max) ?? 0;
  const vfdPrice = val(d.vfdPrice);
  const drpPrice = val(d.drpPrice);
  return {
    paPrice: val(d.paPrice),
    motorPrice: val(d.motorPrice),
    gearboxPrice: val(d.gearboxPrice),
    vfdPrice,
    mechSealPrice: val(d.mechSealPrice),
    mechSealModel: val(d.mechSealPrice) !== null && d.mechSealModel ? d.mechSealModel : null,
    // A picked model only means something alongside a VFD price (the API
    // applies the same rule).
    vfdModel: vfdPrice !== null && d.vfdModel ? d.vfdModel : null,
    drpModel: drpPrice !== null && d.drpModel ? d.drpModel : null,
    paBasis: val(d.paPrice) !== null && d.paBasis ? d.paBasis : null,
    strainerPrice: val(d.strainerPrice),
    prvPrice: val(d.prvPrice),
    drpPrice,
    others: d.others.map((o) => ({
      name: o.name.trim(),
      price: val(o.price),
      discountPct: pct(o.discountPct, MAX_DISCOUNT_PCT),
      markupPct: pct(o.markupPct, MAX_MARKUP_PCT),
    })),
    // Blank = 0 (the page pre-fills the 25 % markup).
    adjust: Object.fromEntries(
      BOI_ITEMS.map((it) => [
        it.key,
        { discountPct: pct(d.adjust[it.key].discountPct, MAX_DISCOUNT_PCT), markupPct: pct(d.adjust[it.key].markupPct, MAX_MARKUP_PCT) },
      ]),
    ),
    remarks: d.remarks.trim(),
  };
};

const PCT_ERROR = "Discount 0–99 %, markup 0–999 %.";
const badPct = (p: PctDraft) =>
  parsePct(p.discountPct, MAX_DISCOUNT_PCT) === undefined || parsePct(p.markupPct, MAX_MARKUP_PCT) === undefined;

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
    if (badPct(o)) errs[`other-${i}-pct`] = PCT_ERROR;
  });
  BOI_ITEMS.forEach((it) => {
    if (badPct(d.adjust[it.key])) errs[`${it.key}-pct`] = PCT_ERROR;
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
  // Tag cards folded to their one-line summary (per tag; Collapse/Expand all).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleTag = (id: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Bumped after each price save so the quotation's live version refreshes.
  const [pricesVersion, setPricesVersion] = useState(0);
  // "Client Price Ref" viewer (the client's old price sheets on SharePoint).
  const [showPriceRef, setShowPriceRef] = useState(false);
  // L1–L4 P&A price lists for the P&A suggestion (null while loading).
  const [paData, setPaData] = useState<PaPriceData | "error" | null>(null);
  useEffect(() => {
    let cancelled = false;
    getPaPriceList()
      .then((d) => !cancelled && setPaData(d))
      .catch(() => !cancelled && setPaData("error"));
    return () => {
      cancelled = true;
    };
  }, []);
  // Two steps: 1 Pump & Qty (product code + quantity per tag), 2 Summary.
  // Opens on Pump & Qty while any tag still lacks either.
  const [stage, setStage] = useState<"pump" | "summary" | null>(null);

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
      setStage((s) => s ?? (res.tags.some((t) => !t.productCode || t.quantity === null) ? "pump" : "summary"));
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
  // Quoted per drive system: one tab (quotation, summary, grand total) per
  // group, plus one for tags whose drive isn't chosen yet.
  const groups = groupsIn(rows.map((r) => r.tag.driveGroup));
  const hasNoDrive = rows.some((r) => r.tag.driveGroup === null);
  const tabs: (DriveGroup | "NONE")[] = [...groups, ...(hasNoDrive ? (["NONE"] as const) : [])];
  const mixed = groups.length > 1;
  const [activeTab, setActiveTab] = useState<DriveGroup | "NONE" | null>(null);
  const tab = activeTab && tabs.includes(activeTab) ? activeTab : (tabs[0] ?? null);
  const groupRows = rows.filter((r) => (r.tag.driveGroup ?? "NONE") === tab);
  const groupDirty = groupRows.some((r) => dirtyIds.includes(r.tag.tagId));
  const tabLabel = (t: DriveGroup | "NONE") => (t === "NONE" ? "No drive yet" : DRIVE_GROUP_LABEL[t]);
  const grand = groupRows.reduce((s, r) => s + r.sub, 0);
  const missingQty = groupRows.filter((r) => r.tag.quantity === null).length;

  const project = data?.project;
  // Commercial Offer sheet of the open drive group — from the SAVED prices.
  const [showOffer, setShowOffer] = useState(false);
  // Each group's Commercial Offer edits — the page sets its scope lists; the
  // modal edits the rest. Re-read after the modal closes so the two never
  // overwrite each other with a stale copy.
  const [offerConfigs, setOfferConfigs] = useState<Record<string, OfferConfig> | null>(null);
  const [scopeSave, setScopeSave] = useState<"" | "saving" | "saved" | "error">("");
  const loadOfferConfigs = useCallback(() => {
    if (!projectId) return;
    getCommercialOffer(projectId)
      .then((d) => setOfferConfigs(d.configs))
      .catch(() => setOfferConfigs((c) => c ?? {}));
  }, [projectId]);
  useEffect(() => {
    loadOfferConfigs();
  }, [loadOfferConfigs]);
  const saveScope = (group: DriveGroup, next: OfferConfig) => {
    setOfferConfigs((m) => ({ ...(m ?? {}), [group]: next }));
    setScopeSave("saving");
    saveCommercialOfferConfig(projectId, group, next)
      .then(() => setScopeSave("saved"))
      .catch(() => setScopeSave("error"));
  };
  // `saved` holds each tag's last-saved prices (data.tags is only the first
  // load), so a Save shows up in the sheet straight away.
  const offerTags = useMemo(
    () =>
      (data?.tags ?? [])
        .filter((t) => (t.driveGroup ?? "NONE") === tab)
        .map((t) => {
          const prices = saved[t.tagId] ? parseDraft(saved[t.tagId]) : t.prices;
          return {
            tagId: t.tagId,
            tagName: t.tagName,
            tech: t.tech,
            pumpModel: t.productCode ?? t.model,
            prices,
            quantity: t.quantity,
            unit: unitTotal(prices),
            sub: subTotal(prices, t.quantity),
          };
        }),
    [data, saved, tab],
  );

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
            <button
              type="button"
              className={btnSm}
              onClick={() => setShowPriceRef(true)}
              disabled={!data}
              title="View this client's past price reference sheets (SharePoint)"
            >
              Client Price Ref
            </button>
            <button
              type="button"
              className={btnSm}
              onClick={() => setShowOffer(true)}
              disabled={!data || !tab || tab === "NONE"}
              title={
                mixed && tab && tab !== "NONE"
                  ? `Commercial Offer sheet for ${tabLabel(tab)} (the open drive-system tab)`
                  : "Preview, edit, print or download the Commercial Offer sheet"
              }
            >
              Commercial Offer
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
        <nav className="flex flex-wrap items-center gap-2" aria-label="Commercial steps">
          {(
            [
              ["pump", "1", "Pump & Qty"],
              ["summary", "2", "Summary"],
            ] as const
          ).map(([key, n, label], i) => {
            const incomplete = key === "pump" ? data.tags.filter((t) => !t.productCode || t.quantity === null).length : 0;
            return (
              <div key={key} className="flex items-center gap-2">
                {i > 0 && <span className="text-fg-4">→</span>}
                <button
                  type="button"
                  onClick={() => setStage(key)}
                  aria-current={stage === key ? "step" : undefined}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                    stage === key ? "border-accent bg-accent text-white" : "border-line bg-paper text-fg-2 hover:border-accent"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      stage === key ? "bg-white/25" : "bg-sunk"
                    }`}
                  >
                    {n}
                  </span>
                  {label}
                  {incomplete > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[11px] ${stage === key ? "bg-white/25" : "bg-[var(--warn-soft)] text-warn"}`}
                      title={`${incomplete} tag${incomplete === 1 ? "" : "s"} without a product code or quantity`}
                    >
                      {incomplete}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>
      )}

      {data && data.tags.length > 0 && stage === "pump" && (
        <PumpQtyStep
          projectId={projectId}
          projectCode={data.project.code}
          projectName={data.project.name}
          tags={data.tags}
          onSaved={(tagId, productCode, quantity, codeParts) => {
            setData((d) =>
              d
                ? { ...d, tags: d.tags.map((t) => (t.tagId === tagId ? { ...t, productCode, quantity, codeParts } : t)) }
                : d,
            );
            // The quotation's live version prices the new quantity.
            setPricesVersion((n) => n + 1);
          }}
          onNext={() => setStage("summary")}
        />
      )}

      {data && data.tags.length > 0 && stage === "summary" && (
        <>
          {tabs.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Drive system">
              {tabs.map((t) => {
                const n = rows.filter((r) => (r.tag.driveGroup ?? "NONE") === t).length;
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={t === tab}
                    onClick={() => setActiveTab(t)}
                    className={`rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                      t === tab ? "border-accent bg-accent-soft text-accent" : "border-line bg-paper text-fg-2 hover:border-accent"
                    }`}
                  >
                    {tabLabel(t)}
                    {t !== "NONE" && mixed && <span className="ml-1.5 font-mono text-[11.5px] opacity-75">/{t}</span>}
                    <span className="ml-1.5 text-[12px] font-normal opacity-75">· {n} tag{n === 1 ? "" : "s"}</span>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "NONE" ? (
            <div className="rounded-xl border border-line bg-paper p-4 text-[13px] text-fg-2">
              These tags have no drive system yet, so they can&apos;t be quoted. Choose the drive on the tag&apos;s Drive step —
              the tag then moves to its drive group&apos;s quotation.
            </div>
          ) : (
            tab && (
              <QuotationPanel
                key={tab}
                projectId={projectId}
                group={tab}
                groupLabel={mixed ? tabLabel(tab) : undefined}
                hasUnsavedPrices={groupDirty}
                pricesVersion={pricesVersion}
              />
            )
          )}

          {tab && tab !== "NONE" && (
            <section className="rounded-xl border border-line bg-paper">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <h2 className="text-[14px] font-semibold text-fg">
                  Scope of Supply{mixed ? ` — ${tabLabel(tab)}` : ""}
                </h2>
                <span className="text-[12px] text-fg-3">
                  {scopeSave === "saving"
                    ? "Saving…"
                    : scopeSave === "saved"
                      ? "Saved — shown on the Commercial Offer"
                      : scopeSave === "error"
                        ? "Couldn't save — try again"
                        : "Printed on the Commercial Offer"}
                </span>
              </header>
              <div className="flex flex-col gap-3 p-4">
                {offerConfigs === null ? (
                  <p className="text-[12.5px] text-fg-3">Loading…</p>
                ) : (
                  <>
                    <ScopeControls
                      config={offerConfigs[tab] ?? EMPTY_OFFER_CONFIG}
                      geared={isGearedGroup(tab)}
                      onChange={(next) => saveScope(tab, next)}
                    />
                    <ScopeLines config={offerConfigs[tab] ?? EMPTY_OFFER_CONFIG} geared={isGearedGroup(tab)} />
                  </>
                )}
              </div>
            </section>
          )}

          {/* Summary across all tags */}
          <section className="rounded-xl border border-line bg-paper">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="text-[14px] font-semibold text-fg">
                Summary{mixed && tab && tab !== "NONE" ? ` — ${tabLabel(tab)}` : ""}
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[12px] text-fg-3">All prices in INR, per unit unless marked</span>
                {tab && tab !== "NONE" && (
                  <button
                    type="button"
                    className={btnSm}
                    onClick={() => setShowOffer(true)}
                    title="Preview, edit, print or download this drive group's Commercial Offer sheet"
                  >
                    Commercial Offer
                  </button>
                )}
              </div>
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
                  {groupRows.map(({ tag, prices, unit, sub }) => (
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
                  {/* Column sums: P&A, BOI and unit price as listed (per unit), qty, sub-total. */}
                  <tr className="border-t-2 border-line-strong bg-sunk">
                    <td colSpan={2} className="px-4 py-3 text-[13px] font-semibold text-fg">
                      Grand Total
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] font-semibold text-fg">
                      {formatInr(groupRows.reduce((s, r) => s + (r.prices.paPrice ?? 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] font-semibold text-fg">
                      {formatInr(groupRows.reduce((s, r) => s + boiTotal(r.prices), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] font-semibold text-fg">
                      {formatInr(groupRows.reduce((s, r) => s + r.unit, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] font-semibold text-fg">
                      {groupRows.reduce((s, r) => s + (r.tag.quantity ?? 0), 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[15px] font-bold text-fg">{formatInr(grand)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {missingQty > 0 && (
              <p className="border-t border-line px-4 py-2.5 text-[12px] text-neg">
                {missingQty} tag{missingQty === 1 ? " has" : "s have"} no quantity, so{" "}
                {missingQty === 1 ? "it counts" : "they count"} as 0. Set Quantity on the Pump &amp; Qty step (step 1 above)
                step.
              </p>
            )}
          </section>

          {groupRows.length > 1 && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={btnSm}
                onClick={() => setCollapsed((cur) => new Set([...cur, ...groupRows.map((r) => r.tag.tagId)]))}
              >
                Collapse all
              </button>
              <button
                type="button"
                className={btnSm}
                onClick={() =>
                  setCollapsed((cur) => new Set([...cur].filter((id) => !groupRows.some((r) => r.tag.tagId === id))))
                }
              >
                Expand all
              </button>
            </div>
          )}

          {groupRows.map(({ tag, prices, unit, sub }) => (
            <TagCard
              key={tag.tagId}
              tag={tag}
              collapsed={collapsed.has(tag.tagId)}
              onToggle={() => toggleTag(tag.tagId)}
              paData={paData}
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

          {/* One remarks note for the whole enquiry — last on the page. */}
          <RemarksCard
            projectId={projectId}
            saved={data.project.remarks}
            onSaved={(remarks) => {
              setData((d) => (d ? { ...d, project: { ...d.project, remarks } } : d));
              // The quotation's live version carries the remarks.
              setPricesVersion((n) => n + 1);
            }}
          />
        </>
      )}
      {showOffer && tab && tab !== "NONE" && (
        <CommercialOfferModal
          projectId={projectId}
          group={tab}
          tags={offerTags}
          unsavedPrices={groupDirty}
          onClose={() => {
            setShowOffer(false);
            loadOfferConfigs();
          }}
        />
      )}
      {showPriceRef && data && (
        <ClientPriceRefModal
          clientCode={data.project.clientCode}
          clientName={data.project.name}
          onClose={() => setShowPriceRef(false)}
        />
      )}
    </div>
  );
}

function TagCard({
  tag,
  collapsed,
  onToggle,
  paData,
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
  /** Folded to the header's one-line summary. */
  collapsed: boolean;
  onToggle: () => void;
  paData: PaPriceData | "error" | null;
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
  const setOther = (i: number, patch: Partial<OtherDraft>) =>
    onChange({ others: draft.others.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  return (
    <section id={`tag-${tag.tagId}`} className="scroll-mt-4 rounded-xl border border-line bg-paper">
      <header
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${collapsed ? "" : "border-b border-line"}`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
          title={collapsed ? "Expand this tag" : "Collapse this tag"}
        >
          <span className="mt-0.5 shrink-0 text-[13px] text-fg-3" aria-hidden="true">
            {collapsed ? "▸" : "▾"}
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-fg">
              {tag.tagName}
              <span className="ml-2 text-[13px] font-normal text-fg-3">{tag.model ?? "No pump selected"}</span>
            </span>
            {collapsed ? (
              <span className="mt-0.5 block text-[12px] text-fg-3">
                {tag.productCode ?? "No product code"} · Unit <b className="font-mono text-fg-2">{formatInr(unit)}</b> ·{" "}
                {tag.quantity === null ? <span className="text-warn">qty not set</span> : `× ${tag.quantity}`} · Sub-total{" "}
                <b className="font-mono text-fg">{formatInr(sub)}</b>
              </span>
            ) : (
              <span className="mt-0.5 block text-[12px] text-fg-3">
                {[tag.media, tag.driveSystem, tag.status].filter(Boolean).join(" · ")}
                {tag.model && !tag.modelConfirmed && <span className="ml-1 text-warn">· model not confirmed</span>}
              </span>
            )}
          </span>
        </button>
        <div className="flex items-center gap-2">
          {dirty && collapsed && <span className="text-[12px] font-medium text-warn">Unsaved changes</span>}
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

      <div className={`grid grid-cols-1 gap-5 p-4 lg:grid-cols-[1fr_280px] ${collapsed ? "hidden" : ""}`}>
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
                  <span className="block text-[11.5px] text-warn">Product code not picked on the Pump &amp; Qty step</span>
                )}
              </p>
              <MoneyInput
                value={draft.paPrice}
                error={errors.paPrice}
                onChange={(v) => onChange({ paPrice: v })}
                label="Pump & Accessories price per unit"
              />
            </div>
            <PaSuggestionPanel
              tag={tag}
              data={paData}
              used={draft.paBasis}
              onUse={(price, basis) => onChange({ paPrice: String(price), paBasis: basis })}
              onClear={() => onChange({ paBasis: "" })}
            />
          </div>

          {/* BOI items */}
          <div>
            <h3 className="mb-2 text-[11.5px] font-semibold tracking-[0.09em] text-fg-3 uppercase">
              BOI Items (bought-out)
            </h3>
            <div className="flex flex-col divide-y divide-line rounded-lg border border-line">
              <div className="hidden justify-end gap-1.5 bg-sunk px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-fg-3 uppercase sm:flex">
                <span className="w-[150px] text-right">Base price</span>
                <span className="w-[68px] text-right">Disc %</span>
                <span className="w-[68px] text-right">Markup %</span>
                <span className="w-[112px] text-right">Price</span>
              </div>
              {BOI_ITEMS.map((item) => {
                const ref = refs[item.key];
                return (
                  <div
                    key={item.key}
                    className="grid grid-cols-1 items-start gap-2 px-3 py-2.5 sm:grid-cols-[110px_1fr]"
                  >
                    <span className="pt-2 text-[13px] font-semibold text-fg">{item.label}</span>
                    <div className="min-w-0 pt-1 text-[12px] text-fg-3">
                      {item.key === "vfdPrice" ? (
                        <VfdPicker
                          tag={tag}
                          picked={draft.vfdModel}
                          onPick={(o) => onChange({ vfdModel: o.driveDescription, vfdPrice: String(o.netPrice ?? "") })}
                          onClear={() => onChange({ vfdModel: "" })}
                        />
                      ) : item.key === "mechSealPrice" ? (
                        <BoiOptionPicker
                          option={
                            tag.mechSealOption && {
                              text: `${tag.mechSealOption.drawingNo} · ${tag.mechSealOption.material} · ${tag.mechSealOption.shaftSizeMm} mm shaft`,
                              label: tag.mechSealOption.label,
                              price: tag.mechSealOption.price,
                            }
                          }
                          note={tag.mechSealNote}
                          used={draft.mechSealModel}
                          onUse={(label, price) => onChange({ mechSealModel: label, mechSealPrice: String(price) })}
                          onClear={() => onChange({ mechSealModel: "" })}
                        />
                      ) : item.key === "drpPrice" ? (
                        <DrpPicker
                          tag={tag}
                          used={draft.drpModel}
                          onUse={(o) => onChange({ drpModel: o.label, drpPrice: String(o.total) })}
                          onClear={() => onChange({ drpModel: "" })}
                        />
                      ) : ref ? (
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
                    <div className="sm:col-span-2">
                      <PriceCluster
                        label={item.label}
                        base={draft[item.key]}
                        pct={draft.adjust[item.key]}
                        net={boiNet(prices, item.key)}
                        error={errors[item.key] || errors[`${item.key}-pct`]}
                        onBase={(v) => onChange({ [item.key]: v } as Partial<Draft>)}
                        onPct={(patch) =>
                          onChange({ adjust: { ...draft.adjust, [item.key]: { ...draft.adjust[item.key], ...patch } } })
                        }
                      />
                    </div>
                  </div>
                );
              })}

              {draft.others.map((o, i) => (
                <div key={i} className="grid grid-cols-1 items-start gap-2 px-3 py-2.5 sm:grid-cols-[110px_1fr]">
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
                  <div className="sm:col-span-2">
                    <PriceCluster
                      label={o.name || "Other item"}
                      base={o.price}
                      pct={o}
                      net={prices.others[i] ? otherNet(prices, prices.others[i]) : null}
                      error={errors[`other-${i}`] || errors[`other-${i}-pct`]}
                      onBase={(v) => setOther(i, { price: v })}
                      onPct={(patch) => setOther(i, patch)}
                    />
                  </div>
                </div>
              ))}

              <div className="px-3 py-2">
                <button
                  type="button"
                  className="text-[12.5px] font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:text-fg-4 disabled:no-underline"
                  onClick={() => onChange({ others: [...draft.others, newOther()] })}
                  disabled={draft.others.length >= MAX_OTHER_ITEMS}
                >
                  + Add other item
                </button>
              </div>
            </div>
          </div>

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
          <p className="mt-1 text-[11.5px] text-fg-3">Quantity comes from the Pump & Qty step (step 1).</p>
        </aside>
      </div>
    </section>
  );
}

/** A BOI row's single BOI Master suggestion (mechanical seal): "Use ₹…"
 *  fills the base price and records the item; or the reason there is none. */
function BoiOptionPicker({
  option,
  note,
  used,
  onUse,
  onClear,
}: {
  option: { text: string; label: string; price: number } | null;
  note: string | null;
  used: string;
  onUse: (label: string, price: number) => void;
  onClear: () => void;
}) {
  const usedLine = used && (
    <span className="flex flex-wrap items-center gap-x-2">
      <span className="text-fg-2">Used: {used}</span>
      <button type="button" className="text-[11.5px] font-semibold text-fg-3 hover:text-neg" onClick={onClear}>
        Clear
      </button>
    </span>
  );
  if (!option) {
    return (
      <span className="flex flex-col gap-1 pt-1">
        {usedLine}
        <span className="text-warn">{note}</span>
      </span>
    );
  }
  const active = used === option.label;
  return (
    <div className="flex flex-col gap-1">
      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2 py-1 ${
          active ? "border-accent bg-accent-soft" : "border-line"
        }`}
      >
        <span className="text-fg-2">{option.text}</span>
        <button
          type="button"
          className="ml-auto rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-[11.5px] text-accent hover:border-accent"
          onClick={() => onUse(option.label, option.price)}
          title="Copy the BOI Master price into this row's base price"
        >
          {active ? "Used" : "Use"} {formatInr(option.price)}
        </button>
      </div>
      {used && !active && usedLine}
    </div>
  );
}

/** The DRP row's reference: the BOI Master RTD probe (smallest size ≥ the
 *  model's shaft dia) + RTD panel. Shown for every tag. */
function DrpPicker({
  tag,
  used,
  onUse,
  onClear,
}: {
  tag: CommercialTag;
  used: string;
  onUse: (o: DrpOption) => void;
  onClear: () => void;
}) {
  const o = tag.drpOption;
  const usedLine = used && (
    <span className="flex flex-wrap items-center gap-x-2">
      <span className="text-fg-2">Used: {used}</span>
      <button type="button" className="text-[11.5px] font-semibold text-fg-3 hover:text-neg" onClick={onClear}>
        Clear
      </button>
    </span>
  );
  if (!o) {
    return (
      <span className="flex flex-col gap-1 pt-1">
        {usedLine}
        <span className="text-warn">{tag.drpNote}</span>
      </span>
    );
  }
  const active = used === o.label;
  return (
    <div className="flex flex-col gap-1">
      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2 py-1 ${
          active ? "border-accent bg-accent-soft" : "border-line"
        }`}
      >
        <span className="text-fg-2">
          {tag.model} · shaft {o.shaftDia} mm → probe {o.probeSizeMm} mm {formatInr(o.probeRate)}
          {o.panelRate !== null && <> + panel {formatInr(o.panelRate)}</>}
        </span>
        {!tag.modelConfirmed && <span className="text-warn">(model not confirmed)</span>}
        <button
          type="button"
          className="ml-auto rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-[11.5px] text-accent hover:border-accent"
          onClick={() => onUse(o)}
          title="Copy the BOI Master DRP price (probe + panel) into this field"
        >
          {active ? "Used" : "Use"} {formatInr(o.total)}
        </button>
      </div>
      {used && !active && usedLine}
    </div>
  );
}

/** "NON SUGAR INDUSTRIES - Price List_V6_" → "Non Sugar Industries V6". */
const levelName = (l: PaLevel) =>
  l.title
    .replace(/\s*-\s*Price List_?/i, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\bNi\b/g, "NI")
    .replace(/\bV(\d)/g, "V$1");
const dmy = (iso: string | null) => (iso ? iso.split("-").reverse().join("-") : "");

/** The P&A price suggestion from the L1–L4 price lists (lib/pa-price.ts):
 *  the tag's model row × MOC column, the sheet's adjustments as tick-boxes
 *  (pre-ticked from the data), one price per list to use. */
function PaSuggestionPanel({
  tag,
  data,
  used,
  onUse,
  onClear,
}: {
  tag: CommercialTag;
  data: PaPriceData | "error" | null;
  used: string;
  onUse: (price: number, basis: string) => void;
  onClear: () => void;
}) {
  const inputs = useMemo(() => paInputsFor(tag), [tag]);
  const sug = useMemo(() => (data && data !== "error" ? paSuggestion(data, inputs) : null), [data, inputs]);
  const defaults = useMemo(
    () => new Set((sug?.adjustments ?? []).filter((a) => a.defaultOn).map((a) => a.key)),
    [sug],
  );
  const [on, setOn] = useState<Set<string>>(defaults);
  useEffect(() => setOn(defaults), [defaults]);
  const toggle = (key: string, group?: string) =>
    setOn((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else {
        // Only one of a group (size up / size down).
        if (group) for (const a of sug?.adjustments ?? []) if (a.group === group) next.delete(a.key);
        next.add(key);
      }
      return next;
    });

  const from = (k: keyof typeof inputs.source) => (inputs.source[k] ? `${k === "subCategory" ? "sub-category" : k} from ${inputs.source[k]}` : null);

  return (
    <div className="mt-2 rounded-lg border border-line bg-sunk/50 p-3 text-[12px] text-fg-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-fg">Price suggestion · L1–L4 price list</span>
        {used && (
          <span className="flex flex-wrap items-center gap-2">
            <span>
              Used: <span className="font-mono text-[11.5px]">{used}</span>
            </span>
            <button type="button" className="text-[11.5px] font-semibold text-fg-3 hover:text-neg" onClick={onClear}>
              Clear
            </button>
          </span>
        )}
      </div>

      {data === null && <p className="mt-1 text-fg-3">Loading the price list…</p>}
      {data === "error" && <p className="mt-1 text-neg">Couldn&apos;t load the price list.</p>}
      {sug?.problem && <p className="mt-1 text-warn">{sug.problem}</p>}

      {sug && !sug.problem && sug.row && sug.col && data && data !== "error" && (
        <div className="mt-1.5 flex flex-col gap-2">
          <p>
            Row <b className="text-fg">{sug.row.pumpModelNo}</b> · MOC <b className="text-fg">{sug.col.toUpperCase()}</b>
            <span className="ml-1 text-fg-3">
              ({[from("model"), from("moc"), from("subCategory"), from("rubber")].filter(Boolean).join(", ")})
            </span>
          </p>
          {sug.notes.length > 0 && <p className="text-fg-3">{sug.notes.join(" · ")}</p>}

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {sug.adjustments.map((a) => (
              <label key={a.key} className="flex cursor-pointer items-center gap-1.5" title={a.note}>
                <input
                  type="checkbox"
                  checked={on.has(a.key)}
                  onChange={() => toggle(a.key, a.group)}
                  className="h-3.5 w-3.5 accent-[var(--brand-blue)]"
                />
                <span className={on.has(a.key) ? "text-fg" : ""}>{a.label}</span>
                {a.note && <span className="text-[11px] text-fg-4">({a.note})</span>}
              </label>
            ))}
          </div>

          <div className="flex flex-col divide-y divide-line rounded-md border border-line bg-paper">
            {data.levels.map((l) => {
              const { base, price } = paPrice(sug, l.level, on);
              const basis = paBasisText(sug, l.level, on);
              const active = used === basis;
              return (
                <div key={l.level} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-1.5 ${active ? "bg-accent-soft" : ""}`}>
                  <span className="w-[22px] font-mono font-semibold text-fg">{l.level}</span>
                  <span className="min-w-0 flex-1 truncate" title={`${l.title} ${l.dateText ?? ""}`}>
                    {levelName(l)} <span className="text-fg-4">· {dmy(l.listDate)}</span>
                  </span>
                  {price === null ? (
                    <span className="text-fg-4">no {sug.col?.toUpperCase()} price in this list</span>
                  ) : (
                    <>
                      <span className="font-mono text-fg-3">list {formatInr(base)}</span>
                      <button
                        type="button"
                        className="rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-[11.5px] text-accent hover:border-accent"
                        onClick={() => onUse(price, basis)}
                        title={basis}
                      >
                        {active ? "Used" : "Use"} {formatInr(price)}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const DUTY_SHORT = { Nominal: "N", "Light Duty": "LD", "Heavy Duty": "HD" } as const;

/** The VFD row's reference: the BOI Master drives covering the motor kW (one
 *  per duty — Nominal / Light Duty / Heavy Duty) when VFD Required = Yes.
 *  Picking one copies its net price in and records the model. */
function VfdPicker({
  tag,
  picked,
  onPick,
  onClear,
}: {
  tag: CommercialTag;
  picked: string;
  onPick: (o: VfdOption) => void;
  onClear: () => void;
}) {
  const pickedLine = picked && (
    <span className="flex flex-wrap items-center gap-x-2">
      <span className="text-fg-2">
        Picked: <span className="font-mono">{picked}</span>
      </span>
      <button type="button" className="text-[11.5px] font-semibold text-fg-3 hover:text-neg" onClick={onClear}>
        Clear
      </button>
    </span>
  );
  const note = (text: string, warn = false) => (
    <span className="flex flex-col gap-1 pt-1">
      {pickedLine}
      <span className={warn ? "text-warn" : undefined}>{text}</span>
    </span>
  );
  if (tag.motorKw === null) return note("No motor kW on the Motor Rating step to match a drive", true);
  if (tag.vfdOptions.length === 0) return note(`No drive in the BOI Master covers ${tag.motorKw} kW`, true);

  return (
    <div className="flex flex-col gap-1.5">
      <span>Motor {tag.motorKw} kW{tag.vfdRequired ? " · VFD required on the Drive step" : ""} · pick a drive (BOI Master: list less discount, plus BOP extra):</span>
      {tag.vfdOptions.map((o) => {
        const active = o.driveDescription === picked;
        return (
          <div
            key={o.driveDescription}
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2 py-1 ${
              active ? "border-accent bg-accent-soft" : "border-line"
            }`}
          >
            <span className="font-mono text-fg-2">{o.driveDescription}</span>
            <span>{[o.make, o.frame && `Frame ${o.frame}`].filter(Boolean).join(" · ")}</span>
            <span>{o.duties.map((d) => `${DUTY_SHORT[d.duty]} ${d.kw} kW`).join(" / ")}</span>
            {o.netPrice !== null && (
              <button
                type="button"
                className="ml-auto rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-[11.5px] text-accent hover:border-accent"
                onClick={() => onPick(o)}
                title={`List ${formatInr(o.listPrice)} less ${o.discountPct ?? 0}% + BOP ${formatInr(o.bopExtra ?? 0)}`}
              >
                {active ? "Picked" : "Use"} {formatInr(o.netPrice)}
              </button>
            )}
          </div>
        );
      })}
      {picked && !tag.vfdOptions.some((o) => o.driveDescription === picked) && pickedLine}
      <span className="text-[11px] text-fg-4">N = Nominal use · LD = Light duty · HD = Heavy duty</span>
    </div>
  );
}

/** One BOI line's price: base (vendor) price, vendor discount %, markup %
 *  (pre-filled 25 %) and the resulting quoted price. */
function PriceCluster({
  label,
  base,
  pct,
  net,
  error,
  onBase,
  onPct,
}: {
  label: string;
  base: string;
  pct: PctDraft;
  net: number | null;
  error?: string;
  onBase: (v: string) => void;
  onPct: (patch: Partial<PctDraft>) => void;
}) {
  const pctInput = (key: keyof PctDraft, aria: string, placeholder: string) => (
    <div className="relative w-[68px] shrink-0">
      <input
        className={`${moneyCls} pr-6`}
        inputMode="decimal"
        placeholder={placeholder}
        value={pct[key]}
        aria-label={`${label} ${aria}`}
        onChange={(e) => onPct({ [key]: e.target.value })}
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[12px] text-fg-3">%</span>
    </div>
  );
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <div className="w-[150px] shrink-0">
          <MoneyInput value={base} onChange={onBase} label={`${label} base price per unit`} />
        </div>
        {pctInput("discountPct", "vendor discount %", "0")}
        {pctInput("markupPct", "markup %", "0")}
        <span className="w-[112px] shrink-0 text-right font-mono text-[13px] font-semibold text-fg" title="Base × (1 − disc %) × (1 + markup %)">
          {formatInr(net)}
        </span>
      </div>
      {error && <span className="text-[11.5px] text-neg">{error}</span>}
    </div>
  );
}

/** One remarks note for the whole Commercial Summary (all tags and groups). */
function RemarksCard({
  projectId,
  saved,
  onSaved,
}: {
  projectId: string;
  saved: string;
  onSaved: (remarks: string) => void;
}) {
  const [text, setText] = useState(saved);
  const [state, setState] = useState<"" | "saving" | "saved" | "error">("");
  useEffect(() => setText(saved), [saved]);
  const dirty = text.trim() !== saved;
  const save = async () => {
    setState("saving");
    try {
      await saveCommercialRemarks(projectId, text.trim());
      onSaved(text.trim());
      setState("saved");
    } catch {
      setState("error");
    }
  };
  return (
    <section className="rounded-xl border border-line bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[14px] font-semibold text-fg">Remarks</h2>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-fg-3">
            {state === "saving" ? "Saving…" : state === "error" ? "Couldn't save — try again" : state === "saved" && !dirty ? "Saved" : "One note for the whole enquiry"}
          </span>
          <button type="button" className={btnPrimarySm} onClick={() => void save()} disabled={!dirty || state === "saving"}>
            Save
          </button>
        </div>
      </header>
      <div className="p-4">
        <textarea
          className={`${inputCls} min-h-[72px] resize-y`}
          value={text}
          maxLength={2000}
          placeholder="Optional notes on these prices"
          onChange={(e) => {
            setText(e.target.value);
            if (state === "saved") setState("");
          }}
          aria-label="Commercial Summary remarks"
        />
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
