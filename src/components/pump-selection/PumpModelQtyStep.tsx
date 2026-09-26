"use client";

import { useState } from "react";
import Stepper from "./Stepper";
import ProductCodeSelect from "./ProductCodeSelect";
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

const STEP = 8;

/**
 * Step 8 — Pump Model & Qty (after Drive). The ERP pump product code (from
 * product_pump), its pump type (PCP, filled in from the code) and the number
 * of pumps for this tag. Persists to pump_model_qty_input; quantity feeds the
 * Commercial Summary. Not an approvable step.
 */
const PumpModelQtyStep = ({ onNext, onPrevious, formData, setFormData, onStepClick }: Props) => {
  const [showErrors, setShowErrors] = useState(false);
  const errors: Record<string, string> = {
    productCode: formData.productCode ? "" : "Select the pump product code.",
    quantity: /^[1-9]\d*$/.test(String(formData.quantity ?? "").trim())
      ? ""
      : "Enter the number of pumps (a whole number, 1 or more).",
  };
  const errorCount = Object.values(errors).filter(Boolean).length;

  const handleNext = () => {
    if (hasErrors(errors)) {
      setShowErrors(true);
      return;
    }
    onNext();
  };

  // Jumping forward on the stepper gets the same check as Next; going back
  // is always allowed.
  const handleStepClick = (target: number) => {
    if (target > STEP && hasErrors(errors)) {
      setShowErrors(true);
      return;
    }
    onStepClick?.(target);
  };

  return (
    <div className="step-container">
      <Stepper currentStep={STEP} maxStep={formData.wizardMaxStep} onStepClick={handleStepClick} />

      <div className="step-card">
        <h2>Pump Model &amp; Qty</h2>
        <p>
          Pick the pump product code for
          {formData.selectedModel ? (
            <>
              {" "}the selected <b className="font-semibold text-fg">{formData.selectedModel}</b>
            </>
          ) : (
            " this tag"
          )}{" "}
          and the number of pumps.
        </p>

        <div className={grid}>
          <div className={`${fieldWrap} sm:col-span-2`}>
            <label className={label}>
              Pump Model (Product Code)
              <Req />
            </label>
            <ProductCodeSelect
              value={formData.productCode ?? ""}
              invalid={showErrors && !!errors.productCode}
              onChange={(productCode, pumpFamily) =>
                setFormData((f: typeof formData) => ({ ...f, productCode, pumpFamily: pumpFamily || "PCP" }))
              }
            />
            <span className={hint}>From the pump product master (PCP). Type parts of the code to search, e.g. &ldquo;rtohv6 8185&rdquo;, or add a new code if it isn&apos;t listed.</span>
            <Err show={showErrors} msg={errors.productCode} />
          </div>

          <div className={fieldWrap}>
            <label className={label}>Pump Type</label>
            <input className={`${control} cursor-not-allowed opacity-80`} value={formData.pumpFamily || "PCP"} readOnly />
          </div>

          <div className={fieldWrap}>
            <label className={label}>
              Quantity (Nos)
              <Req />
            </label>
            <input
              type="number"
              min={1}
              step={1}
              placeholder="Number of pumps"
              className={control}
              value={formData.quantity ?? ""}
              onChange={(e) => setFormData((f: typeof formData) => ({ ...f, quantity: e.target.value }))}
            />
            <span className={hint}>Used for the Commercial Summary sub-total.</span>
            <Err show={showErrors} msg={errors.quantity} />
          </div>
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

export default PumpModelQtyStep;
