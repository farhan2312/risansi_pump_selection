import Stepper from "./Stepper";
import "./GeneralInformationStep.css";
import { actions, btnGhost, btnPrimary, control, fieldWrap, grid, hint, label } from "./formStyles";
import { needsBkAg } from "../../lib/suction-discharge-size";
import { toCp } from "../../utils/units";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  onStepClick?: (step: number) => void;
};

// Viscosity range list — mirrors Model_vs_Viscosity_vs_Size.xlsx (the 5
// columns whose labels are stored on pump_model_master as the size_visc_*
// columns). Ranges are in cP; a cSt input is converted with SG first
// (cP = cSt × SG). Boundaries are treated as non-overlapping (upper-inclusive)
// — the source labels write "1000-3000" but that collides with "0-1000" at
// 1000, so 1000 stays in the lower band here.
const viscosityRangeFor = (viscosityCp: number): string => {
  if (viscosityCp <= 1000) return "0-1000";
  if (viscosityCp <= 3000) return "1000-3000";
  if (viscosityCp <= 5000) return "3000-5000";
  if (viscosityCp <= 10000) return "5000-10000";
  return ">10000";
};

// Convert temperature to Celsius (the canonical value stored in formData.temperature).
const toCelsius = (value: number, unit: string): number => {
  if (unit === "F") return ((value - 32) * 5) / 9;
  if (unit === "K") return value - 273.15;
  return value;
};

// Round to 2 decimals for the derived Celsius value, without trailing zeros.
const round2 = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return String(r);
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
  // viscosityCp is the canonical converted value (cP = cSt × SG) — same shape
  // as temperature's canonical Celsius field — so anything downstream can
  // read the real cP value without re-parsing viscosity + viscosityUnit + sg.
  const applyViscosity = (viscosity: string, viscosityUnit: string) => {
    const num = parseFloat(viscosity);
    const sg = parseFloat(formData.sg) || 1;
    const cp = toCp(num, viscosityUnit, sg);
    const viscosityRange = Number.isNaN(cp) ? "" : viscosityRangeFor(cp);
    const viscosityCp = Number.isNaN(cp) ? "" : round2(cp);
    setFormData({ ...formData, viscosity, viscosityUnit, viscosityRange, viscosityCp });
  };

  // Store the as-entered value in temperatureRaw + temperatureUnit for display,
  // and the canonical Celsius conversion in temperature (what everything else
  // reads). Empty input clears the derived Celsius so downstream checks
  // (formData.temperature ? …) still work.
  const applyTemperature = (temperatureRaw: string, temperatureUnit: string) => {
    const num = parseFloat(temperatureRaw);
    const temperature = Number.isNaN(num) ? "" : round2(toCelsius(num, temperatureUnit));
    setFormData({ ...formData, temperatureRaw, temperatureUnit, temperature });
  };

  const tempUnit = formData.temperatureUnit;
  const tempRawNum = parseFloat(formData.temperatureRaw ?? "");
  const tempCelsius = Number.isNaN(tempRawNum) ? null : toCelsius(tempRawNum, tempUnit);

  return (
    <div className="step-container">
      <Stepper currentStep={2} maxStep={formData.wizardMaxStep} onStepClick={onStepClick} />

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
            {formData.viscosityCp && formData.viscosityUnit === "cSt" && (
              <span className={hint}>
                = <b className="mono font-semibold text-fg">{formData.viscosityCp}</b> cP
              </span>
            )}
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
              <option value="1000-3000">1000 - 3000</option>
              <option value="3000-5000">3000 - 5000</option>
              <option value="5000-10000">5000 - 10000</option>
              <option value=">10000">10000 &amp; Above</option>
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
            <label className={label}>Solid Type</label>
            <select
              className={control}
              value={formData.solidType ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, solidType: e.target.value })
              }
            >
              <option value="">Select Solid Type</option>
              <option value="Hard Solid">Hard Solid</option>
              <option value="Soft Solid">Soft Solid</option>
            </select>
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
            <label className={label}>Temperature</label>
            <input
              type="number"
              placeholder="Enter Temperature"
              className={control}
              value={formData.temperatureRaw ?? ""}
              onChange={(e) => applyTemperature(e.target.value, tempUnit)}
            />
            {tempCelsius !== null && tempUnit !== "C" && (
              <span className={hint}>
                = <b className="mono font-semibold text-fg">{round2(tempCelsius)}</b> °C
              </span>
            )}
          </div>

          <div className={fieldWrap}>
            <label className={label}>Temperature Unit</label>
            <select
              className={control}
              value={tempUnit}
              onChange={(e) => applyTemperature(formData.temperatureRaw ?? "", e.target.value)}
            >
              <option value="">Select</option>
              <option value="C">°C</option>
              <option value="F">°F</option>
              <option value="K">K</option>
            </select>
          </div>
        </div>

 {needsBkAg(formData.viscosityRange, formData.solidPercentage) && (
  <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
    <p className="text-sm font-semibold text-orange-900">
      BK / AG Recommendation
    </p>

    <p className="mt-2 text-sm text-orange-800">
      Based on the selected viscosity and/or solids content, it is recommended
      to use the <strong>BK</strong> or <strong>AG</strong> feed/construction
      option. Please select either <strong>BK</strong> or <strong>AG</strong> in
      the <strong>Specifications</strong> step.
    </p>
  </div>
)}


        {!formData.modelConfirmed && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Pick a pump model in the recommendation panel below and confirm it to continue.
          </div>
        )}

        <div className={actions}>
          <button className={btnGhost} onClick={onPrevious}>
            Previous
          </button>
          <button
            className={`${btnPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}
            onClick={onNext}
            disabled={!formData.modelConfirmed}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default FluidPropertiesStep;
