import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import { actions, btnGhost, btnPrimary, control, fieldWrap, grid, hint, label } from "./formStyles";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  onStepClick?: (step: number) => void;
};

// Cascading options driven by Pump Type. Each pump type constrains which AG/BK
// feed option and which suction housings are valid:
//   Horizontal Standard       -> no AG/BK; standard / CIP housings only
//   Vertical                  -> AG only; vertical suction housing only
//   Horizontal Bucket w/Auger -> AG & BK only; all housings
//   Horizontal Auger Only     -> AG only; standard / CIP housings only
const ALL_SUCTION_HOUSINGS = [
  "Standard Pump Housing",
  "Bucket",
  "Pump Housing with CIP",
  "Bucket with CIP",
  "Vertical Suction Housing",
];
const STANDARD_CIP_HOUSINGS = ["Standard Pump Housing", "Pump Housing with CIP"];

const AG_BK_OPTIONS_BY_PUMP_TYPE: Record<string, string[]> = {
  "Horizontal Standard": [],
  Vertical: ["AG"],
  "Horizontal Bucket with Auger": ["AG & BK"],
  "Horizontal Auger Only": ["AG"],
};
const SUCTION_HOUSINGS_BY_PUMP_TYPE: Record<string, string[]> = {
  "Horizontal Standard": STANDARD_CIP_HOUSINGS,
  Vertical: ["Vertical Suction Housing"],
  "Horizontal Bucket with Auger": ALL_SUCTION_HOUSINGS,
  "Horizontal Auger Only": STANDARD_CIP_HOUSINGS,
};

const agBkOptionsFor = (pumpType: string): string[] =>
  AG_BK_OPTIONS_BY_PUMP_TYPE[pumpType] ?? [];
// Before a pump type is chosen, show every housing so the field isn't empty;
// once chosen it narrows, and an invalid prior pick is cleared on change.
const suctionHousingOptionsFor = (pumpType: string): string[] =>
  pumpType ? SUCTION_HOUSINGS_BY_PUMP_TYPE[pumpType] ?? ALL_SUCTION_HOUSINGS : ALL_SUCTION_HOUSINGS;

const OperatingConditionsStep = ({
  onNext,
  onPrevious,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  // Pump Type cascades to AG/BK + Suction Housing: auto-pick the single valid
  // AG/BK option (or clear it), and clear a suction housing the new pump type
  // no longer allows.
  const handlePumpTypeChange = (pumpType: string) => {
    const agOpts = agBkOptionsFor(pumpType);
    const suctionOpts = suctionHousingOptionsFor(pumpType);
    setFormData({
      ...formData,
      pumpType,
      agBk:
        agOpts.length === 1
          ? agOpts[0]
          : agOpts.includes(formData.agBk)
            ? formData.agBk
            : "",
      suctionHousing: suctionOpts.includes(formData.suctionHousing)
        ? formData.suctionHousing
        : "",
    });
  };

  const agBkOptions = agBkOptionsFor(formData.pumpType);
  const suctionHousingOptions = suctionHousingOptionsFor(formData.pumpType);

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
              onChange={(e) => handlePumpTypeChange(e.target.value)}
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

          {/* AG / BK feed option — availability + choices are decided by the
              selected pump type (Horizontal Standard has none). */}
          {agBkOptions.length > 0 && (
            <div className={fieldWrap}>
              <label className={label}>AG / BK</label>
              <select
                className={control}
                value={formData.agBk ?? ""}
                onChange={(e) =>
                  setFormData({ ...formData, agBk: e.target.value })
                }
              >
                {agBkOptions.length > 1 && <option value="">Select AG / BK</option>}
                {agBkOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <span className={hint}>Set by the selected pump type.</span>
            </div>
          )}

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
              {suctionHousingOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
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
