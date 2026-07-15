import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import { toM3PerHr, toMwc, fmt } from "../../utils/units";
import {
  actions,
  btnPrimary,
  control,
  fieldWrap,
  fullWidth,
  grid,
  hint,
  label,
} from "./formStyles";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  onNext: () => void;
  onStepClick?: (step: number) => void;
};

const GeneralInformationStep = ({
  onNext,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  const sg = parseFloat(formData.sg) || 1;

  const capNum = parseFloat(formData.capacity);
  const capConv =
    formData.capacityUnit && formData.capacityUnit !== "M3/hr" && !isNaN(capNum)
      ? toM3PerHr(capNum, formData.capacityUnit, sg)
      : null;

  const headNum = parseFloat(formData.head);
  const headConv =
    formData.headUnit && formData.headUnit !== "MWC" && !isNaN(headNum)
      ? toMwc(headNum, formData.headUnit, sg)
      : null;

  return (
    <div className="step-container">
      <Stepper currentStep={1} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>General Information</h2>
        <p>Enter the basic operating parameters required for pump selection.</p>

        <div className={grid}>
          <div className={fieldWrap}>
            <label className={label}>Capacity</label>
            <input
              type="number"
              placeholder="Enter Capacity"
              className={control}
              value={formData.capacity}
              onChange={(e) =>
                setFormData({ ...formData, capacity: e.target.value })
              }
            />
            {capConv !== null && (
              <span className={hint}>
                = <b className="mono font-semibold text-fg">{fmt(capConv)}</b>{" "}
                m³/hr
                {formData.capacityUnit === "TPH" && !formData.sg && (
                  <em className="not-italic text-warn"> (using SG 1.0 — set Specific Gravity)</em>
                )}
              </span>
            )}
          </div>

          <div className={fieldWrap}>
            <label className={label}>Capacity Unit</label>
            <select
              className={control}
              value={formData.capacityUnit}
              onChange={(e) =>
                setFormData({ ...formData, capacityUnit: e.target.value })
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

          <div className={fieldWrap}>
            <label className={label}>Head / Discharge Pressure</label>
            <input
              type="number"
              placeholder="Enter Head"
              className={control}
              value={formData.head}
              onChange={(e) => setFormData({ ...formData, head: e.target.value })}
            />
            {headConv !== null && (
              <span className={hint}>
                = <b className="mono font-semibold text-fg">{fmt(headConv)}</b>{" "}
                MWC
                {formData.headUnit === "MLC" && !formData.sg && (
                  <em className="not-italic text-warn"> (using SG 1.0 — set Specific Gravity)</em>
                )}
              </span>
            )}
          </div>

          <div className={fieldWrap}>
            <label className={label}>Head Unit</label>
            <select
              className={control}
              value={formData.headUnit}
              onChange={(e) =>
                setFormData({ ...formData, headUnit: e.target.value })
              }
            >
              <option value="">Select</option>
              <option value="MWC">MWC</option>
              <option value="MLC">MLC</option>
              <option value="Bar">Bar</option>
              <option value="Kg/cm²">Kg/cm²</option>
            </select>
          </div>

          <div className={fieldWrap}>
            <label className={label}>Specific Gravity</label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 1.0 water, 1.4 molasses"
              className={control}
              value={formData.sg}
              onChange={(e) => setFormData({ ...formData, sg: e.target.value })}
            />
          </div>

          <div className={fieldWrap}>
            <label className={label}>RPM Range</label>
            <select
              className={control}
              value={formData.rpmRange ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, rpmRange: e.target.value })
              }
            >
              <option value="">Any RPM range</option>
              <option value="low">Low ( &lt; 200 )</option>
              <option value="medium">Medium ( 200 – 320 )</option>
              <option value="high">High ( 320 – 400 )</option>
              <option value="vhigh">Very High ( &gt; 400 )</option>
            </select>
          </div>

          <div className={`${fieldWrap} ${fullWidth}`}>
            <label className={label}>Media / Application</label>
            <input
              type="text"
              placeholder="Molasses, Syrup, Sludge, Chemical..."
              className={control}
              value={formData.media}
              onChange={(e) => setFormData({ ...formData, media: e.target.value })}
            />
          </div>
        </div>

        <div className={actions}>
          <button className={btnPrimary} onClick={onNext}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeneralInformationStep;
