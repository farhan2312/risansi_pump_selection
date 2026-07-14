import Stepper from "./Stepper";
import "./GeneralInformationStep.css";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  formData: any;
  setFormData: any;
  onStepClick?: (step: number) => void;
};

const FluidPropertiesStep = ({
  onNext,
  onPrevious,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  return (
    <div className="step-container">
      <Stepper currentStep={2} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Fluid Properties</h2>

        <p>
          Enter the fluid characteristics required for pump selection.
        </p>

        <div className="form-grid">

          <div className="form-group">
            <label>Viscosity</label>
            <input
              type="number"
              placeholder="Enter Viscosity"
              value={formData.viscosity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  viscosity: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group">
            <label>Viscosity Unit</label>
            <select
              value={formData.viscosityUnit}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  viscosityUnit: e.target.value,
                })
              }
            >
              <option value="">Select</option>
              <option value="cP">cP</option>
              <option value="cSt">cSt</option>
            </select>
          </div>

          <div className="form-group">
            <label>Viscosity Range</label>
            <input
              type="text"
              placeholder="Enter Range"
              value={formData.viscosityRange}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  viscosityRange: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group">
            <label>Solid %</label>
            <input
              type="number"
              placeholder="Enter Solid %"
              value={formData.solidPercentage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  solidPercentage: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group">
            <label>Solid Size (mm)</label>
            <input
              type="number"
              placeholder="Enter Solid Size"
              value={formData.solidSize}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  solidSize: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group">
            <label>pH Value</label>
            <input
              type="number"
              placeholder="Enter pH"
              value={formData.ph}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  ph: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group">
            <label>Temperature (°C)</label>
            <input
              type="number"
              placeholder="Enter Temperature"
              value={formData.temperature}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  temperature: e.target.value,
                })
              }
            />
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

export default FluidPropertiesStep;