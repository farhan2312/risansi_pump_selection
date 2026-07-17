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
                setFormData({
                  ...formData,
                  driveSystem: e.target.value,
                  gearBoxType:
                    e.target.value === "Geared Motor Drive"
                      ? formData.gearBoxType
                      : "",
                  gearBoxMounting:
                    e.target.value === "Geared Motor Drive"
                      ? formData.gearBoxMounting
                      : "",
                  asfRange:
                    e.target.value === "Geared Motor Drive"
                      ? formData.asfRange
                      : "",
                })
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
            <select
              className={control}
              value={formData.gearboxMake}
              onChange={(e) =>
                setFormData({ ...formData, gearboxMake: e.target.value })
              }
            >
              <option value="">Select Gearbox Make</option>
              <option value="Bonfiglioli">Bonfiglioli</option>
              <option value="Elecon">Elecon</option>
              <option value="Flender">Flender</option>
              <option value="Radicon">Radicon</option>
              <option value="SEW Eurodrive">SEW Eurodrive</option>
              <option value="Shanthi Gears">Shanthi Gears</option>
              <option value="David Brown Santasalo">
                David Brown Santasalo
              </option>
              <option value="Other">Other</option>
            </select>
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

          {formData.driveSystem === "Geared Motor Drive" && (
            <>
              <div className={fieldWrap}>
                <label className={label}>Gear Box Type</label>
                <select
                  className={control}
                  value={formData.gearBoxType}
                  onChange={(e) =>
                    setFormData({ ...formData, gearBoxType: e.target.value })
                  }
                >
                  <option value="">Select Gear Box Type</option>
                  <option value="HISO">HISO (Hollow Input Solid Output)</option>
                  <option value="SISO">SISO (Solid Input Solid Output)</option>
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>Gear Box Mounting</label>
                <select
                  className={control}
                  value={formData.gearBoxMounting}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      gearBoxMounting: e.target.value,
                    })
                  }
                >
                  <option value="">Select Mounting</option>
                  <option value="Foot Mount B3">Foot Mount (B3)</option>
                  <option value="Flange Mount B5">Flange Mount (B5)</option>
                  <option value="Foot cum Flange B35">
                    Foot cum Flange (B35)
                  </option>
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>ASF Range</label>
                <select
                  className={control}
                  value={formData.asfRange}
                  onChange={(e) =>
                    setFormData({ ...formData, asfRange: e.target.value })
                  }
                >
                  <option value="">Select ASF Range</option>
                  <option value="1.4-2">1.4 - 2</option>
                  <option value="2.1-3">2.1 - 3</option>
                  <option value="3.1+">3.1 &amp; Above</option>
                </select>
              </div>
            </>
          )}
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
