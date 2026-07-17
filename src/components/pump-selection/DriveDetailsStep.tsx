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

const DriveDetailsStep = ({
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
        <h2>Drive Details</h2>
        <p>Select the drive system and motor specification.</p>

        <div className={grid}>
          <div className={fieldWrap}>
            <label className={label}>Drive System Type</label>
            <select
              className={control}
              value={formData.driveSystem}
              onChange={(e) =>
                setFormData({ ...formData, driveSystem: e.target.value })
              }
            >
              <option value="">Select Drive System</option>
              <option value="Direct Drive">Direct Drive</option>
              <option value="V-Belt Drive">V-Belt Drive</option>
              <option value="Geared Motor Drive">Geared Motor Drive</option>
            </select>
          </div>

          <div className={fieldWrap}>
            <label className={label}>Motor Make</label>
            <input
              type="text"
              placeholder="ABB / Siemens / CG..."
              className={control}
              value={formData.motorMake}
              onChange={(e) =>
                setFormData({ ...formData, motorMake: e.target.value })
              }
            />
          </div>

          <div className={fieldWrap}>
            <label className={label}>Gearbox Make</label>
            <input
              type="text"
              placeholder="Bonfiglioli / Elecon..."
              className={control}
              value={formData.gearboxMake}
              onChange={(e) =>
                setFormData({ ...formData, gearboxMake: e.target.value })
              }
            />
          </div>

          <div className={fieldWrap}>
            <label className={label}>Motor RPM</label>
            <select
              className={control}
              value={formData.motorRPM}
              onChange={(e) =>
                setFormData({ ...formData, motorRPM: e.target.value })
              }
            >
              <option value="">Select Motor RPM</option>
              <option value="960">960</option>
              <option value="1440">1440</option>
            </select>
          </div>
        </div>

        <div className={actions}>
          <button className={btnGhost} onClick={onPrevious}>
            Previous
          </button>
          <button className={btnPrimary} onClick={onNext}>
            Get Recommendations
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriveDetailsStep;
