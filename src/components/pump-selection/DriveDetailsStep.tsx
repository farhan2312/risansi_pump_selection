import "./GeneralInformationStep.css";
import Stepper from "./Stepper";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  formData: any;
  setFormData: any;
  onStepClick?: (step: number) => void;
};

const DriveDetailsStep = ({
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
        <h2>Drive Details</h2>

        <p>
          Select the drive system and motor specification.
        </p>

        <div className="form-grid">

          <div className="form-group">
            <label>Drive System Type</label>
            <select
              value={formData.driveSystem}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  driveSystem: e.target.value,
                })
              }
            >
              <option value="">Select Drive System</option>
              <option value="Direct Drive">Direct Drive</option>
              <option value="V-Belt Drive">V-Belt Drive</option>
              <option value="Geared Motor Drive">Geared Motor Drive</option>
            </select>
          </div>

          <div className="form-group">
            <label>Motor Make</label>
            <input
              type="text"
              placeholder="ABB / Siemens / CG..."
              value={formData.motorMake}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  motorMake: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group">
            <label>Gearbox Make</label>
            <input
              type="text"
              placeholder="Bonfiglioli / Elecon..."
              value={formData.gearboxMake}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  gearboxMake: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group">
            <label>Motor RPM</label>
            <select
              value={formData.motorRPM}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  motorRPM: e.target.value,
                })
              }
            >
              <option value="">Select Motor RPM</option>
              <option value="960">960</option>
              <option value="1440">1440</option>
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

export default DriveDetailsStep;
