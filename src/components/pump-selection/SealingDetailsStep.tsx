import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import { actions, btnGhost, btnPrimary, control, fieldWrap, grid, label } from "./formStyles";

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
      <Stepper currentStep={4} onStepClick={onStepClick} />

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
                  sealingSubType:
                    e.target.value === "Mechanical Seal"
                      ? formData.sealingSubType
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
