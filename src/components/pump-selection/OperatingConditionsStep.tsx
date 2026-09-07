"use client";

import { useState } from "react";
import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import { actions, btnGhost, btnPrimary, control, fieldWrap, grid, hint, label } from "./formStyles";
import { Err, ErrorBanner, Req, hasErrors } from "./fieldBits";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  onStepClick?: (step: number) => void;
};

// Cascading options driven by Pump Type. Each pump type constrains which AG/BK
// feed option and which suction housings are valid:
//   Horizontal Standard       -> no AG/BK; standard / CIP housings only
//   Vertical                  -> AG only; vertical suction housing only
//   Horizontal Bucket w/Auger -> AG & BK only; all housings
//   Horizontal Auger Only     -> AG only; standard / CIP housings only
const ALL_SUCTION_HOUSINGS = [
  "Standard Pump Housing",
  "Bucket",
  "Pump Housing with CIP",
  "Bucket with CIP",
];
const STANDARD_CIP_HOUSINGS = ["Standard Pump Housing", "Pump Housing with CIP"];

const AG_BK_OPTIONS_BY_PUMP_TYPE: Record<string, string[]> = {
  "Horizontal Standard": [],
  Vertical: ["AG"],
  "Horizontal Bucket with Auger": ["AG & BK"],
  "Horizontal Auger Only": ["AG"],
};
const SUCTION_HOUSINGS_BY_PUMP_TYPE: Record<string, string[]> = {
  "Horizontal Standard": STANDARD_CIP_HOUSINGS,
  Vertical: ["Vertical Suction Housing"],
  "Horizontal Bucket with Auger": ALL_SUCTION_HOUSINGS,
  "Horizontal Auger Only": STANDARD_CIP_HOUSINGS,
};

// Some jobs genuinely do not need a feed aid even when the pump type offers
// one. "Not Required" is always available alongside the real options, and
// picking it makes the remarks box mandatory so the reason is on record.
export const AG_BK_NOT_REQUIRED = "Not Required";

// Only vertical pumps hang into the sump, so only they are asked how far the
// suction reaches below the mounting flange.
const VERTICAL_PUMP_TYPE = "Vertical";
const NEGATIVE_SUCTION_UNITS = ["mt", "mm"];

const agBkOptionsFor = (pumpType: string): string[] =>
  AG_BK_OPTIONS_BY_PUMP_TYPE[pumpType] ?? [];
// Before a pump type is chosen, show every housing so the field isn't empty;
// once chosen it narrows, and an invalid prior pick is cleared on change.
const suctionHousingOptionsFor = (pumpType: string): string[] =>
  pumpType ? SUCTION_HOUSINGS_BY_PUMP_TYPE[pumpType] ?? ALL_SUCTION_HOUSINGS : ALL_SUCTION_HOUSINGS;

const OperatingConditionsStep = ({
  onNext,
  onPrevious,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  // Pump Type cascades to AG/BK + Suction Housing: auto-pick the single valid
  // AG/BK option (or clear it), and clear a suction housing the new pump type
  // no longer allows.
  const handlePumpTypeChange = (pumpType: string) => {
    const agOpts = agBkOptionsFor(pumpType);
    const suctionOpts = suctionHousingOptionsFor(pumpType);
    // An explicit "Not Required" survives a pump-type change - it is the
    // user's decision, not a default we are free to overwrite. Otherwise the
    // sole valid option is auto-picked and an invalid prior pick is cleared.
    const agBk =
      agOpts.length === 0
        ? ""
        : formData.agBk === AG_BK_NOT_REQUIRED
          ? AG_BK_NOT_REQUIRED
          : agOpts.length === 1
            ? agOpts[0]
            : agOpts.includes(formData.agBk)
              ? formData.agBk
              : "";
    const isVertical = pumpType === VERTICAL_PUMP_TYPE;
    setFormData({
      ...formData,
      pumpType,
      agBk,
      agBkRemarks: agBk === AG_BK_NOT_REQUIRED ? formData.agBkRemarks ?? "" : "",
      // A depth captured for a vertical pump means nothing once the type
      // changes, so it is dropped rather than carried into the quotation.
      negativeSuctionSize: isVertical ? formData.negativeSuctionSize ?? "" : "",
      negativeSuctionUnit: isVertical
        ? formData.negativeSuctionUnit || NEGATIVE_SUCTION_UNITS[0]
        : "",
      suctionHousing: suctionOpts.includes(formData.suctionHousing)
        ? formData.suctionHousing
        : "",
    });
  };

  const agBkOptions = agBkOptionsFor(formData.pumpType);
  const suctionHousingOptions = suctionHousingOptionsFor(formData.pumpType);
  const agBkNotRequired = formData.agBk === AG_BK_NOT_REQUIRED;
  const isVertical = formData.pumpType === VERTICAL_PUMP_TYPE;

  // Remarks only belong to "Not Required" - switching back to a real option
  // drops them so a stale justification cannot follow the pump into a
  // quotation that does use a feed aid.
  const handleAgBkChange = (agBk: string) =>
    setFormData({
      ...formData,
      agBk,
      agBkRemarks: agBk === AG_BK_NOT_REQUIRED ? formData.agBkRemarks ?? "" : "",
    });

  // Every specification is required - they all feed the MOC component split,
  // the quotation and the built pump. AG/BK is the one conditional field: it
  // only applies to pump types that offer it (Horizontal Standard has none).
  const [showErrors, setShowErrors] = useState(false);
  const errors: Record<string, string> = {
    pumpType: formData.pumpType ? "" : "Select a pump type.",
    agBk:
      agBkOptions.length === 0 || formData.agBk ? "" : "Select an AG / BK option.",
    agBkRemarks:
      agBkNotRequired && !(formData.agBkRemarks ?? "").trim()
        ? "Explain why AG / BK is not required."
        : "",
    bearingHousing: formData.bearingHousing ? "" : "Select a bearing housing.",
    suctionHousing: formData.suctionHousing ? "" : "Select a suction housing.",
    jointType: formData.jointType ? "" : "Select a joint type.",
    negativeSuctionSize:
      !isVertical || (formData.negativeSuctionSize ?? "").trim()
        ? ""
        : "Negative suction size is required for a vertical pump.",
    negativeSuctionUnit:
      !isVertical || formData.negativeSuctionUnit
        ? ""
        : "Select a negative suction unit.",
  };
  const errorCount = Object.values(errors).filter(Boolean).length;

  const handleNext = () => {
    if (hasErrors(errors)) {
      setShowErrors(true);
      return;
    }
    onNext();
  };

  return (
    <div className="step-container">
      <Stepper currentStep={3} maxStep={formData.wizardMaxStep} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Specifications</h2>
        <p>Select the pump&apos;s structural specifications.</p>

        <div className={grid}>
          <div className={fieldWrap}>
            <label className={label}>Pump Type<Req /></label>
            <select
              className={control}
              value={formData.pumpType}
              onChange={(e) => handlePumpTypeChange(e.target.value)}
            >
              <option value="">Select Pump Type</option>
              <option value="Horizontal Standard">Horizontal Standard</option>
              <option value="Horizontal Bucket with Auger">
                Horizontal Bucket with Auger
              </option>
              <option value="Horizontal Auger Only">
                Horizontal Auger Only
              </option>
              <option value="Vertical">Vertical</option>
            </select>
            <Err show={showErrors} msg={errors.pumpType} />
          </div>

          {/* AG / BK feed option — availability + choices are decided by the
              selected pump type (Horizontal Standard has none). */}
          {agBkOptions.length > 0 && (
            <div className={fieldWrap}>
              <label className={label}>AG / BK<Req /></label>
              <select
                className={control}
                value={formData.agBk ?? ""}
                onChange={(e) => handleAgBkChange(e.target.value)}
              >
                {agBkOptions.length > 1 && <option value="">Select AG / BK</option>}
                {agBkOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                <option value={AG_BK_NOT_REQUIRED}>{AG_BK_NOT_REQUIRED}</option>
              </select>
              <span className={hint}>
                Suggested by the selected pump type — choose “{AG_BK_NOT_REQUIRED}”
                if this job does not need a feed aid.
              </span>
              <Err show={showErrors} msg={errors.agBk} />
            </div>
          )}

          {/* Marking AG/BK as not required is a deliberate deviation from what
              the pump type suggests, so the reason is mandatory. */}
          {agBkOptions.length > 0 && agBkNotRequired && (
            <div className={fieldWrap}>
              <label className={label}>Why AG / BK Is Not Required<Req /></label>
              <textarea
                className={control}
                rows={2}
                placeholder="Reason for omitting AG / BK"
                value={formData.agBkRemarks ?? ""}
                onChange={(e) =>
                  setFormData({ ...formData, agBkRemarks: e.target.value })
                }
              />
              <Err show={showErrors} msg={errors.agBkRemarks} />
            </div>
          )}

          <div className={fieldWrap}>
            <label className={label}>Bearing Housing<Req /></label>
            <select
              className={control}
              value={formData.bearingHousing}
              onChange={(e) =>
                setFormData({ ...formData, bearingHousing: e.target.value })
              }
            >
              <option value="">Select Bearing Housing</option>
              <option value="Bearing Housing">Bearing Housing</option>
              <option value="Close Coupled">Close Coupled</option>
            </select>
            <Err show={showErrors} msg={errors.bearingHousing} />
          </div>

          <div className={fieldWrap}>
            <label className={label}>Suction Housing<Req /></label>
            <select
              className={control}
              value={formData.suctionHousing}
              onChange={(e) =>
                setFormData({ ...formData, suctionHousing: e.target.value })
              }
            >
              <option value="">Select Suction Housing</option>
              {suctionHousingOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <Err show={showErrors} msg={errors.suctionHousing} />
          </div>

          <div className={fieldWrap}>
            <label className={label}>Joint Type<Req /></label>
            <select
              className={control}
              value={formData.jointType}
              onChange={(e) =>
                setFormData({ ...formData, jointType: e.target.value })
              }
            >
              <option value="">Select Joint Type</option>
              <option value="Eccentric Joint">Eccentric Joint</option>
              <option value="Cardan Joint 2">Cardan Joint 2</option>
              <option value="CJSM">CJSM</option>
            </select>
            <Err show={showErrors} msg={errors.jointType} />
          </div>

          {/* Vertical pumps only: how far the suction hangs below the mounting
              flange. Entered in metres or millimetres. */}
          {isVertical && (
            <div className={fieldWrap}>
              <label className={label}>Negative Suction Size<Req /></label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Enter Negative Suction Size"
                  className={control}
                  value={formData.negativeSuctionSize ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, negativeSuctionSize: e.target.value })
                  }
                />
                <select
                  className={control}
                  value={formData.negativeSuctionUnit || NEGATIVE_SUCTION_UNITS[0]}
                  onChange={(e) =>
                    setFormData({ ...formData, negativeSuctionUnit: e.target.value })
                  }
                >
                  {NEGATIVE_SUCTION_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <Err
                show={showErrors}
                msg={errors.negativeSuctionSize || errors.negativeSuctionUnit}
              />
            </div>
          )}
        </div>

        <ErrorBanner show={showErrors} count={errorCount} />

        <div className={actions}>
          <button className={btnGhost} onClick={onPrevious}>
            Previous
          </button>
          <button className={btnPrimary} onClick={handleNext}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default OperatingConditionsStep;
