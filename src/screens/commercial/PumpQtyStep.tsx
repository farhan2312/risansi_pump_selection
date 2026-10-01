"use client";

import { useMemo, useState } from "react";

import ProductCodeSelect from "../../components/pump-selection/ProductCodeSelect";
import { DRIVE_GROUP_LABEL, type CommercialTag } from "../../lib/commercial";
import { saveWizardInput } from "../../services/wizardInputService";

// Commercial step 1 — Pump & Qty (moved out of the pump-selection wizard,
// 2026-10-01): per tag, the ERP pump product code (from product_pump, a new
// code can be added), its pump type (PCP) and the number of pumps. Saved to
// pump_model_qty_input; the Summary step prices quantity × unit price.

type Row = { productCode: string; pumpFamily: string; quantity: string };

const rowOf = (t: CommercialTag): Row => ({
  productCode: t.productCode ?? "",
  pumpFamily: "PCP",
  quantity: t.quantity === null ? "" : String(t.quantity),
});

const errorsOf = (r: Row) => ({
  productCode: r.productCode ? "" : "Pick the pump product code.",
  quantity: /^[1-9]\d*$/.test(r.quantity.trim()) ? "" : "Enter a whole number, 1 or more.",
});

const btn =
  "inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-fg-2 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export default function PumpQtyStep({
  projectId,
  tags,
  onSaved,
  onNext,
}: {
  projectId: string;
  tags: CommercialTag[];
  /** A tag's saved product code + quantity, so the page's data follows. */
  onSaved: (tagId: string, productCode: string, quantity: number) => void;
  onNext: () => void;
}) {
  const initial = useMemo(() => Object.fromEntries(tags.map((t) => [t.tagId, rowOf(t)])), [tags]);
  const [rows, setRows] = useState<Record<string, Row>>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedOnce, setSavedOnce] = useState(false);

  const row = (id: string) => rows[id] ?? initial[id];
  const set = (id: string, patch: Partial<Row>) => {
    setRows((m) => ({ ...m, [id]: { ...row(id), ...patch } }));
    setSavedOnce(false);
  };
  const dirtyIds = tags
    .map((t) => t.tagId)
    .filter((id) => {
      const a = row(id);
      const b = initial[id];
      return a.productCode !== b.productCode || a.quantity.trim() !== b.quantity;
    });
  const invalidIds = tags.map((t) => t.tagId).filter((id) => Object.values(errorsOf(row(id))).some(Boolean));

  /** Saves every changed, valid row. Returns true when nothing is left invalid. */
  const save = async (): Promise<boolean> => {
    setSaveError("");
    if (invalidIds.length > 0) setShowErrors(true);
    const toSave = dirtyIds.filter((id) => !invalidIds.includes(id));
    if (toSave.length === 0) return invalidIds.length === 0;
    setSaving(true);
    try {
      for (const id of toSave) {
        const r = row(id);
        const quantity = r.quantity.trim();
        await saveWizardInput("pump-model-qty", projectId, { productCode: r.productCode, pumpFamily: r.pumpFamily || "PCP", quantity }, id);
        onSaved(id, r.productCode, Number(quantity));
      }
      setSavedOnce(true);
      return invalidIds.length === 0;
    } catch {
      setSaveError("Couldn't save — check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (await save()) onNext();
  };

  return (
    <section className="rounded-xl border border-line bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-fg">Pump &amp; Qty</h2>
          <p className="text-[12px] text-fg-3">
            Pick each tag&apos;s pump product code and the number of pumps — the Summary prices them per unit × quantity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedOnce && dirtyIds.length === 0 && <span className="text-[12px] font-medium text-pos">Saved</span>}
          <button type="button" className={btn} onClick={() => void save()} disabled={saving || dirtyIds.length === 0}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className={btnPrimary} onClick={() => void next()} disabled={saving}>
            Next: Summary →
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11.5px] font-semibold tracking-[0.06em] text-fg-3 uppercase">
              <th className="px-4 py-2.5">Tag</th>
              <th className="px-4 py-2.5">Selected pump</th>
              <th className="w-[38%] px-4 py-2.5">Pump Model (Product Code)</th>
              <th className="px-4 py-2.5">Pump Type</th>
              <th className="w-[130px] px-4 py-2.5">Quantity (Nos)</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((t) => {
              const r = row(t.tagId);
              const err = errorsOf(r);
              return (
                <tr key={t.tagId} className="border-b border-line align-top last:border-b-0">
                  <td className="px-4 py-3 font-semibold text-fg">{t.tagName}</td>
                  <td className="px-4 py-3 text-fg-2">
                    {t.model ?? <span className="text-fg-4">No pump selected</span>}
                    {t.model && !t.modelConfirmed && <span className="block text-[11.5px] text-warn">model not confirmed</span>}
                    <span className="block text-[11.5px] text-fg-3">
                      {t.driveGroup ? DRIVE_GROUP_LABEL[t.driveGroup] : "No drive yet"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <ProductCodeSelect
                      value={r.productCode}
                      invalid={showErrors && !!err.productCode}
                      onChange={(productCode, pumpFamily) => set(t.tagId, { productCode, pumpFamily: pumpFamily || "PCP" })}
                    />
                    {showErrors && err.productCode && <span className="mt-1 block text-[11.5px] text-neg">{err.productCode}</span>}
                  </td>
                  <td className="px-4 py-3 text-fg-2">{r.pumpFamily || "PCP"}</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      className={`w-full rounded-lg border bg-paper px-3 py-2 text-right font-mono text-[13px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft ${
                        showErrors && err.quantity ? "border-neg" : "border-line"
                      }`}
                      value={r.quantity}
                      onChange={(e) => set(t.tagId, { quantity: e.target.value })}
                      aria-label={`Quantity for ${t.tagName}`}
                    />
                    {showErrors && err.quantity && <span className="mt-1 block text-[11.5px] text-neg">{err.quantity}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(saveError || (showErrors && invalidIds.length > 0)) && (
        <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-neg">
          {saveError ||
            `${invalidIds.length} tag${invalidIds.length === 1 ? " needs" : "s need"} a product code and quantity before the Summary.`}
        </p>
      )}
    </section>
  );
}
