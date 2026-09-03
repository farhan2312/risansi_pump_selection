"use client";

import { useEffect, useState } from "react";
import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import { actions, btnGhost, btnPrimary, control, fieldWrap, fullWidth, grid, label } from "./formStyles";

// Sentinel for the "type it in" branch of a make dropdown. Never stored — the
// field holds either a listed make or whatever was typed.
const OTHER = "Other";

// Packing materials offered when Sealing Type = Gland Packing — the
// Gland-Packing counterpart to the Mechanical Seal sub-types below.
const GLAND_PACKING_TYPES = [
  "GAGP",
  "Teflon",
  "PTFE",
  "Carbon Fiber",
  "Asbestos-Free",
] as const;
// Listed makes. "Other" is offered alongside them and swaps the dropdown for a
// free-text box, so a make that isn't on the list can still be recorded — the
// typed value is stored in the SAME field, so nothing downstream changes.
const GLAND_PACKING_MAKES = ["Champion"] as const;

// Mechanical Seal options.
const MECH_SEAL_TYPES = ["MSA", "SCG", "DCG", "MSK"] as const;
// Auto-shown description for the chosen seal type (read-only guidance). It is
// derived from the seal type rather than stored, so the Summary step and the
// PDF report resolve it through mechSealDescription() below instead of reading
// a persisted column.
export const MECH_SEAL_DESCRIPTIONS: Record<string, string> = {
  MSA: "Single Balanced Mechanical Seal with Seal cover, external water quenched.",
  // Plain ASCII punctuation on purpose: these descriptions now flow into the
  // Summary step and the generated PDF, and the PDF's standard fonts are
  // normalised to Latin-1 elsewhere in the app (see UNICODE_REPLACEMENTS in
  // moc-pdf-report.ts) - a hyphen renders identically everywhere.
  MSK: "Single Unbalanced spring-loaded O-ring, internally mounted, cooled by liquid - no external water quench.",
  SCG: "Single cartridge Mechanical Seal, internal quenched & flush (water + liquid).",
  DCG: "Double cartridge Mechanical Seal, internal quenched & flush (water + liquid).",
};

/** Description for a Mechanical Seal type, or "" when none applies (no type
 * chosen, or the sealing arrangement is Gland Packing). */
export function mechSealDescription(sealingSubType: string | undefined | null): string {
  if (!sealingSubType) return "";
  return MECH_SEAL_DESCRIPTIONS[sealingSubType] ?? "";
}
const MECH_SEAL_MOCS = [
  "SS304",
  "SS316",
  "SS316L",
  "Super Duplex Seal",
  "904L",
  "Hastelloy",
] as const;
const MECH_SEAL_FACES = [
  { value: "TC vs. TC", label: "TC vs. TC (Tungsten Carbide)" },
  { value: "SiC vs. SiC", label: "SiC vs. SiC (Silicon Carbide)" },
] as const;
const MECH_SEAL_MAKES = ["ACME", "Eagle Burgmann", "Sealmatic"] as const;

/** A make dropdown that falls back to free text. `options` are the listed
 * makes; picking "Other" swaps in a text box whose value is written straight
 * back to `value`, so the stored field is always the real make. A loaded value
 * that isn't on the list re-opens in the "Other" state automatically. */
const MakeField = ({
  label: fieldLabel,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) => {
  const isListed = value !== "" && options.includes(value);
  const [other, setOther] = useState(value !== "" && !isListed);

  // A value loaded from the DB (or set elsewhere) that isn't one of the listed
  // makes must show as "Other" with the text filled in.
  useEffect(() => {
    if (value !== "" && !options.includes(value)) setOther(true);
  }, [value, options]);

  return (
    <div className={fieldWrap}>
      <label className={label}>{fieldLabel}</label>
      <select
        className={control}
        value={other ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setOther(true);
            onChange("");
          } else {
            setOther(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">Select Make</option>
        {options.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value={OTHER}>{OTHER}</option>
      </select>
      {other && (
        <input
          className={control}
          type="text"
          autoFocus
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
};

// Fields cleared when Sealing Type is switched, so a stale sub-type/make/etc.
// from the other arrangement never lingers.
const MECH_SEAL_FIELDS = {
  sealingSubType: "",
  mechSealMoc: "",
  mechSealFace: "",
  mechSealMake: "",
};
const GLAND_PACKING_FIELDS = {
  glandPackingType: "",
  glandPackingMake: "",
};

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  onStepClick?: (step: number) => void;
};

const SealingDetailsStep = ({
  onNext,
  onPrevious,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  const isMechSeal = formData.sealingType === "Mechanical Seal";
  const isGlandPacking = formData.sealingType === "Gland Packing";
  const sealDescription = mechSealDescription(formData.sealingSubType as string);
  // Persisted on the MOC step when the AI suggestion was generated.
  const aiSeal = (formData.mocAiSuggestedSealRecommendation as string) ?? "";
  const aiSealMoc = (formData.mocAiSuggestedSealMoc as string) ?? "";
  const aiSealRationale = (formData.mocAiSuggestedSealRationale as string) ?? "";

  return (
    <div className="step-container">
      <Stepper currentStep={5} maxStep={formData.wizardMaxStep} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Sealing Details</h2>
        <p>Select the sealing arrangement for this pump.</p>

        {/* Sealing recommendation carried over from the MOC step, shown here
            too so the arrangement can be judged against it without going back
            a step. Only appears once a suggestion has been generated. */}
        {aiSeal && (
          <div className="mb-[14px] rounded-lg border-2 border-emerald-400 bg-emerald-50 pl-[14px] pr-[14px] pt-[12px] pb-[12px]">
            <span className="section-label">Recommended Sealing</span>
            <div className="mt-1 text-[14px] font-semibold text-fg">{aiSeal}</div>
            {aiSealMoc && (
              <div className="mt-1 text-[12px] text-emerald-900">
                <span className="font-semibold">Seal MOC:</span> {aiSealMoc}
              </div>
            )}
            {aiSealRationale && (
              <p className="mt-1 text-[12px] leading-[1.5] text-emerald-900">
                {aiSealRationale}
              </p>
            )}
          </div>
        )}

        <div className={grid}>
          <div className={fieldWrap}>
            <label className={label}>Sealing Type</label>
            <select
              className={control}
              value={formData.sealingType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sealingType: e.target.value,
                  // The two arrangements are mutually exclusive — switching
                  // clears whichever set of sub-fields no longer applies.
                  ...(e.target.value === "Mechanical Seal" ? GLAND_PACKING_FIELDS : {}),
                  ...(e.target.value === "Gland Packing" ? MECH_SEAL_FIELDS : {}),
                  ...(e.target.value === "" ? { ...MECH_SEAL_FIELDS, ...GLAND_PACKING_FIELDS } : {}),
                })
              }
            >
              <option value="">Select</option>
              <option value="Mechanical Seal">Mechanical Seal</option>
              <option value="Gland Packing">Gland Packing</option>
            </select>
          </div>

          {isMechSeal && (
            <>
              <div className={fieldWrap}>
                <label className={label}>Mechanical Seal Type</label>
                <select
                  className={control}
                  value={formData.sealingSubType}
                  onChange={(e) =>
                    setFormData({ ...formData, sealingSubType: e.target.value })
                  }
                >
                  <option value="">Select Seal Type</option>
                  {MECH_SEAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description of the chosen seal type — a full-width callout so
                  the engineer reads the arrangement in words, not just the
                  code. Carried through to the Summary step and the PDF. */}
              {sealDescription && (
                <div
                  className={`${fullWidth} overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm`}
                >
                  <div className="flex items-start gap-3 pl-[14px] pr-[14px] pt-[12px] pb-[12px]">
                    {/* Pill, not a circle - the seal codes are 3 characters. */}
                    <span className="mt-[1px] inline-flex flex-none items-center rounded-md bg-blue-100 pl-[8px] pr-[8px] pt-[3px] pb-[3px] text-[11.5px] font-bold tracking-[0.04em] text-blue-700">
                      {formData.sealingSubType}
                    </span>
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.09em] text-blue-700">
                        Description
                      </span>
                      <p className="mt-[3px] text-[13.5px] leading-[1.5] text-slate-800">
                        {sealDescription}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className={fieldWrap}>
                <label className={label}>Seal MOC</label>
                <select
                  className={control}
                  value={formData.mechSealMoc ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, mechSealMoc: e.target.value })
                  }
                >
                  <option value="">Select MOC</option>
                  {MECH_SEAL_MOCS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>Seal Face</label>
                <select
                  className={control}
                  value={formData.mechSealFace ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, mechSealFace: e.target.value })
                  }
                >
                  <option value="">Select Face</option>
                  {MECH_SEAL_FACES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <MakeField
                label="Seal Make"
                options={MECH_SEAL_MAKES}
                value={formData.mechSealMake ?? ""}
                onChange={(next) => setFormData({ ...formData, mechSealMake: next })}
                placeholder="Enter seal make"
              />
            </>
          )}

          {isGlandPacking && (
            <>
              <div className={fieldWrap}>
                <label className={label}>Gland Packing Type</label>
                <select
                  className={control}
                  value={formData.glandPackingType ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, glandPackingType: e.target.value })
                  }
                >
                  <option value="">Select Packing Type</option>
                  {GLAND_PACKING_TYPES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <MakeField
                label="Gland Packing Make"
                options={GLAND_PACKING_MAKES}
                value={formData.glandPackingMake ?? ""}
                onChange={(next) => setFormData({ ...formData, glandPackingMake: next })}
                placeholder="Enter packing make"
              />
            </>
          )}
        </div>

        <div className={actions}>
          <button className={btnGhost} onClick={onPrevious}>
            Previous
          </button>
          <button className={btnPrimary} onClick={onNext}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default SealingDetailsStep;
