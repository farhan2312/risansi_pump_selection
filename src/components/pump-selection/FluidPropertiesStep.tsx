import Stepper from "./Stepper";
import "./GeneralInformationStep.css";
import { actions, btnGhost, btnPrimary, control, fieldWrap, grid, hint, label } from "./formStyles";
import { SIZE_BY_RANGE } from "../../lib/suction-discharge-size";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  onStepClick?: (step: number) => void;
};

// Viscosity range list from the Step-5 spec sheet. Ranges are in cP; a cSt
// input is converted with SG first (cP = cSt × SG). Boundaries are treated as
// non-overlapping (upper-inclusive) — the sheet writes "3000-5000" but that
// collides with "1001-3000" at 3000, so 3000 stays in the lower band here.
const viscosityRangeFor = (viscosityCp: number): string => {
  if (viscosityCp <= 1000) return "0-1000";
  if (viscosityCp <= 3000) return "1001-3000";
  if (viscosityCp <= 5000) return "3001-5000";
  if (viscosityCp <= 7000) return "5001-7000";
  if (viscosityCp <= 10000) return "7001-10000";
  return "10000+";
};


const FluidPropertiesStep = ({
  onNext,
  onPrevious,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  // Re-derive the viscosity range whenever viscosity or its unit changes, so
  // the range is auto-selected (spec: "when enter viscosity it automatically
  // select viscosity range"). Still overridable via the dropdown afterward.
  const applyViscosity = (viscosity: string, viscosityUnit: string) => {
    const num = parseFloat(viscosity);
    const sg = parseFloat(formData.sg) || 1;
    const cp = viscosityUnit === "cSt" ? num * sg : num;
    const viscosityRange = Number.isNaN(cp) ? "" : viscosityRangeFor(cp);
    setFormData({ ...formData, viscosity, viscosityUnit, viscosityRange });
  };

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
              onChange={(e) => applyViscosity(e.target.value, formData.viscosityUnit)}
            />
          </div>

          <div className={fieldWrap}>
            <label className={label}>Viscosity Unit</label>
            <select
              className={control}
              value={formData.viscosityUnit}
              onChange={(e) => applyViscosity(formData.viscosity, e.target.value)}
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
            <span className={hint}>
              Auto-selected from viscosity — override if needed.
            </span>
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

        {formData.viscosityRange && SIZE_BY_RANGE[formData.viscosityRange] !== undefined && (
          <div className="mt-4 rounded-md border border-line bg-elev p-4">
            <span className="section-label">Suction &amp; Discharge Size</span>
            <div className="mt-2 flex items-baseline gap-2">
              <b className="mono text-[22px] font-semibold text-fg">
                {SIZE_BY_RANGE[formData.viscosityRange]}
              </b>
              <span className="text-[12px] text-fg-3">
                recommended size for viscosity range {formData.viscosityRange} cP
                {formData.selectedModel ? ` · model ${formData.selectedModel}` : ""}
              </span>
            </div>
            {formData.viscosityRange === "10000+" && (
              <p className="mt-2 text-[12px] text-warn">
                Viscosity above 10&nbsp;000&nbsp;cP — also recommend the{" "}
                <b>BK</b> and <b>AG</b> feed/construction options for thick media.
              </p>
            )}
            {!formData.selectedModel && (
              <p className="mt-2 text-[12px] text-fg-3">
                Pin a pump in the live panel below to tie this size to a specific model.
              </p>
            )}
          </div>
        )}

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
