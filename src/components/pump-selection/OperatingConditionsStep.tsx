import "./GeneralInformationStep.css";
import Stepper from "./Stepper";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  formData: any;
  setFormData: any;
  onStepClick?: (step: number) => void;
};

const OperatingConditionsStep = ({
  onNext,
  onPrevious,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  return (
    <div className="step-container">
      <Stepper currentStep={3} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Specifications</h2>

        <p>
          Select the pump's structural specifications.
        </p>

        <div className="form-grid">

          {/* Pump Type */}
          <div className="form-group">
            <label>Pump Type</label>
            <select
              value={formData.pumpType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  pumpType: e.target.value,
                })
              }
            >
              <option value="">Select Pump Type</option>
              <option value="Standard Pump">Standard Pump</option>
              <option value="Bucket Pump">Bucket Pump</option>
              <option value="Standard Pump with Auger">
                Standard Pump with Auger
              </option>
              <option value="Vertical Pump">Vertical Pump</option>
            </select>
          </div>

          {/* Bearing Housing */}
          <div className="form-group">
            <label>Bearing Housing</label>
            <select
              value={formData.bearingHousing}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bearingHousing: e.target.value,
                })
              }
            >
              <option value="">Select Bearing Housing</option>
              <option value="Bearing Housing">Bearing Housing</option>
              <option value="Close Coupled">Close Coupled</option>
            </select>
          </div>

          {/* Suction Housing */}
          <div className="form-group">
            <label>Suction Housing</label>
            <select
              value={formData.suctionHousing}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  suctionHousing: e.target.value,
                })
              }
            >
              <option value="">Select Suction Housing</option>
              <option value="Standard Pump Housing">
                Standard Pump Housing
              </option>
              <option value="Bucket">Bucket</option>
              <option value="Pump Housing with CIP">
                Pump Housing with CIP
              </option>
              <option value="Bucket with CIP">
                Bucket with CIP
              </option>
            </select>
          </div>

          {/* Joint Type */}
          <div className="form-group">
            <label>Joint Type</label>
            <select
              value={formData.jointType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  jointType: e.target.value,
                })
              }
            >
              <option value="">Select Joint Type</option>
              <option value="Eccentric Joint">
                Eccentric Joint
              </option>
              <option value="Cardan Joint 2">
                Cardan Joint 2
              </option>
              <option value="CJSM">CJSM</option>
            </select>
          </div>

        </div>

        <div className="step-actions">
          <button onClick={onPrevious}>
            Previous
          </button>

          <button onClick={onNext}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default OperatingConditionsStep;