import "./GeneralInformationStep.css";
import Stepper from "./Stepper";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  formData: any;
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
      <Stepper currentStep={5} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Sealing Details</h2>

        <p>
          Select the sealing arrangement for this pump.
        </p>

        <div className="form-grid">

          <div className="form-group">
            <label>Sealing Type</label>
            <select
              value={formData.sealingType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sealingType: e.target.value,
                })
              }
            >
              <option value="">Select</option>
              <option value="Mechanical Seal">Mechanical Seal</option>
              <option value="Gland Packing">Gland Packing</option>
            </select>
          </div>

        </div>

        <div className="step-actions">
          <button onClick={onPrevious}>
            Previous
          </button>

          <button onClick={onNext}>
            Get Recommendations
          </button>
        </div>
      </div>
    </div>
  );
};

export default SealingDetailsStep;
