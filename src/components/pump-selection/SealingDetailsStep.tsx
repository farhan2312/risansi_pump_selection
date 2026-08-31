"use client";

import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import { actions, btnGhost, btnPrimary, control, fieldWrap, grid, label } from "./formStyles";

// Packing materials offered when Sealing Type = Gland Packing — the
// Gland-Packing counterpart to the Mechanical Seal sub-types below.
const GLAND_PACKING_TYPES = [
  "GAGP",
  "Teflon",
  "PTFE",
  "Carbon Fiber",
  "Asbestos-Free",
] as const;

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
  return (
    <div className="step-container">
      <Stepper currentStep={5} maxStep={formData.wizardMaxStep} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Sealing Details</h2>
        <p>Select the sealing arrangement for this pump.</p>

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
                  // The two sub-type fields are mutually exclusive — switching
                  // sealing type clears whichever no longer applies.
                  sealingSubType:
                    e.target.value === "Mechanical Seal"
                      ? formData.sealingSubType
                      : "",
                  glandPackingType:
                    e.target.value === "Gland Packing"
                      ? formData.glandPackingType
                      : "",
                })
              }
            >
              <option value="">Select</option>
              <option value="Mechanical Seal">Mechanical Seal</option>
              <option value="Gland Packing">Gland Packing</option>
            </select>
          </div>

          {formData.sealingType === "Mechanical Seal" && (
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
                <option value="MSA">MSA</option>
                <option value="SCG">SCG</option>
                <option value="DCG">DCG</option>
                <option value="MSK">MSK</option>
              </select>
            </div>
          )}

          {formData.sealingType === "Gland Packing" && (
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
