import "./GeneralInformationStep.css";
import Stepper from "./Stepper";

type Props = {
  onNext: () => void;
  formData: any;
  setFormData: any;
  onStepClick?: (step: number) => void;
};

const GeneralInformationStep = ({
  onNext,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  return (
    <div className="step-container">
      <Stepper currentStep={1} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>General Information</h2>

        <p>
          Enter the basic operating parameters required for pump selection.
        </p>

        <div className="form-grid">

          <div className="form-group">
            <label>Capacity</label>
            <input
              type="number"
              placeholder="Enter Capacity"
              value={formData.capacity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  capacity: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group">
            <label>Capacity Unit</label>
            <select
              value={formData.capacityUnit}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  capacityUnit: e.target.value,
                })
              }
            >
              <option value="">Select</option>
              <option value="M3/hr">M³/hr</option>
              <option value="LPH">LPH</option>
              <option value="GPM">GPM</option>
              <option value="KLPD">KLPD</option>
              <option value="TPH">TPH</option>
            </select>
          </div>

          <div className="form-group">
            <label>Head / Discharge Pressure</label>
            <input
              type="number"
              placeholder="Enter Head"
              value={formData.head}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  head: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group">
            <label>Head Unit</label>
            <select
              value={formData.headUnit}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  headUnit: e.target.value,
                })
              }
            >
              <option value="">Select</option>
              <option value="MWC">MWC</option>
              <option value="MLC">MLC</option>
              <option value="Bar">Bar</option>
              <option value="Kg/cm²">Kg/cm²</option>
            </select>
          </div>

          <div className="form-group">
            <label>Specific Gravity</label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 1.0 water, 1.4 molasses"
              value={formData.sg}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sg: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group full-width">
            <label>Media / Application</label>
            <input
              type="text"
              placeholder="Molasses, Syrup, Sludge, Chemical..."
              value={formData.media}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  media: e.target.value,
                })
              }
            />
          </div>

        </div>

        <div className="step-actions">
          <button onClick={onNext}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeneralInformationStep;