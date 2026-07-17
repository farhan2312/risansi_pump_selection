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
        <p>Select the pump&apos;s structural specifications.</p>

        <div className={grid}>
          <div className={fieldWrap}>
            <label className={label}>Pump Type</label>
            <select
              className={control}
              value={formData.pumpType}
              onChange={(e) =>
                setFormData({ ...formData, pumpType: e.target.value })
              }
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
          </div>

          <div className={fieldWrap}>
            <label className={label}>Bearing Housing</label>
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
          </div>

          <div className={fieldWrap}>
            <label className={label}>Suction Housing</label>
            <select
              className={control}
              value={formData.suctionHousing}
              onChange={(e) =>
                setFormData({ ...formData, suctionHousing: e.target.value })
              }
            >
              <option value="">Select Suction Housing</option>
              <option value="Standard Pump Housing">Standard Pump Housing</option>
              <option value="Bucket">Bucket</option>
              <option value="Pump Housing with CIP">Pump Housing with CIP</option>
              <option value="Bucket with CIP">Bucket with CIP</option>
            </select>
          </div>

          <div className={fieldWrap}>
            <label className={label}>Joint Type</label>
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

export default OperatingConditionsStep;
