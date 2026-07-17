import Stepper from "./Stepper";
import "./GeneralInformationStep.css";
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
        <p>Enter the fluid characteristics required for pump selection.</p>

        <div className={grid}>
          <div className={fieldWrap}>
            <label className={label}>Viscosity</label>
            <input
              type="number"
              placeholder="Enter Viscosity"
              className={control}
              value={formData.viscosity}
              onChange={(e) =>
                setFormData({ ...formData, viscosity: e.target.value })
              }
            />
          </div>

          <div className={fieldWrap}>
            <label className={label}>Viscosity Unit</label>
            <select
              className={control}
              value={formData.viscosityUnit}
              onChange={(e) =>
                setFormData({ ...formData, viscosityUnit: e.target.value })
              }
            >
              <option value="">Select</option>
              <option value="cP">cP</option>
              <option value="cSt">cSt</option>
            </select>
          </div>

          <div className={fieldWrap}>
            <label className={label}>Viscosity Range (cP)</label>
            <select
              className={control}
              value={formData.viscosityRange}
              onChange={(e) =>
                setFormData({ ...formData, viscosityRange: e.target.value })
              }
            >
              <option value="">Select Range</option>
              <option value="0-1000">0 - 1000</option>
              <option value="1001-3000">1001 - 3000</option>
              <option value="3001-5000">3001 - 5000</option>
              <option value="5001-7000">5001 - 7000</option>
              <option value="7001-10000">7001 - 10000</option>
              <option value="10000+">10000 &amp; Above</option>
            </select>
          </div>

          <div className={fieldWrap}>
            <label className={label}>Solid %</label>
            <input
              type="number"
              placeholder="Enter Solid %"
              className={control}
              value={formData.solidPercentage}
              onChange={(e) =>
                setFormData({ ...formData, solidPercentage: e.target.value })
              }
            />
          </div>

          <div className={fieldWrap}>
            <label className={label}>Solid Size (mm)</label>
            <input
              type="number"
              placeholder="Enter Solid Size"
              className={control}
              value={formData.solidSize}
              onChange={(e) =>
                setFormData({ ...formData, solidSize: e.target.value })
              }
            />
          </div>

          <div className={fieldWrap}>
            <label className={label}>pH Value</label>
            <input
              type="number"
              placeholder="Enter pH"
              className={control}
              value={formData.ph}
              onChange={(e) => setFormData({ ...formData, ph: e.target.value })}
            />
          </div>

          <div className={fieldWrap}>
            <label className={label}>Temperature (°C)</label>
            <input
              type="number"
              placeholder="Enter Temperature"
              className={control}
              value={formData.temperature}
              onChange={(e) =>
                setFormData({ ...formData, temperature: e.target.value })
              }
            />
          </div>
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

export default FluidPropertiesStep;
