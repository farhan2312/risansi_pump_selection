"use client";

import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import { actions, btnGhost, btnPrimary, control, fieldWrap, grid, hint, label } from "./formStyles";

// Packing materials offered when Sealing Type = Gland Packing — the
// Gland-Packing counterpart to the Mechanical Seal sub-types below.
const GLAND_PACKING_TYPES = [
  "GAGP",
  "Teflon",
  "PTFE",
  "Carbon Fiber",
  "Asbestos-Free",
] as const;
const GLAND_PACKING_MAKES = ["Champion", "Other"] as const;

// Mechanical Seal options.
const MECH_SEAL_TYPES = ["MSA", "SCG", "DCG", "MSK"] as const;
// Auto-shown description for the chosen seal type (read-only guidance).
const MECH_SEAL_DESCRIPTIONS: Record<string, string> = {
  MSA: "Single Balanced Mechanical Seal with Seal cover, external water quenched.",
  MSK: "Single Unbalanced spring-loaded O-ring, internally mounted, cooled by liquid — no external water quench.",
  SCG: "Single cartridge Mechanical Seal, internal quenched & flush (water + liquid).",
  DCG: "Double cartridge Mechanical Seal, internal quenched & flush (water + liquid).",
};
const MECH_SEAL_MOCS = [
  "SS304",
  "SS316",
  "SS316L",
  "Super Duplex Seal",
  "904L",
  "Hastelloy",
] as const;
const MECH_SEAL_FACES = [
  { value: "TC vs. TC", label: "TC vs. TC (Tungsten Carbide)" },
  { value: "SiC vs. SiC", label: "SiC vs. SiC (Silicon Carbide)" },
] as const;
const MECH_SEAL_MAKES = ["ACME", "Eagle Burgmann", "Sealmatic"] as const;

// Fields cleared when Sealing Type is switched, so a stale sub-type/make/etc.
// from the other arrangement never lingers.
const MECH_SEAL_FIELDS = {
  sealingSubType: "",
  mechSealMoc: "",
  mechSealFace: "",
  mechSealMake: "",
};
const GLAND_PACKING_FIELDS = {
  glandPackingType: "",
  glandPackingMake: "",
};

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  onStepClick?: (step: number) => void;
};

const SealingDetailsStep = ({
  onNext,
  onPrevious,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  const isMechSeal = formData.sealingType === "Mechanical Seal";
  const isGlandPacking = formData.sealingType === "Gland Packing";
  const sealDescription = MECH_SEAL_DESCRIPTIONS[formData.sealingSubType as string];

  return (
    <div className="step-container">
      <Stepper currentStep={5} maxStep={formData.wizardMaxStep} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Sealing Details</h2>
        <p>Select the sealing arrangement for this pump.</p>

        <div className={grid}>
          <div className={fieldWrap}>
            <label className={label}>Sealing Type</label>
            <select
              className={control}
              value={formData.sealingType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sealingType: e.target.value,
                  // The two arrangements are mutually exclusive — switching
                  // clears whichever set of sub-fields no longer applies.
                  ...(e.target.value === "Mechanical Seal" ? GLAND_PACKING_FIELDS : {}),
                  ...(e.target.value === "Gland Packing" ? MECH_SEAL_FIELDS : {}),
                  ...(e.target.value === "" ? { ...MECH_SEAL_FIELDS, ...GLAND_PACKING_FIELDS } : {}),
                })
              }
            >
              <option value="">Select</option>
              <option value="Mechanical Seal">Mechanical Seal</option>
              <option value="Gland Packing">Gland Packing</option>
            </select>
          </div>

          {isMechSeal && (
            <>
              <div className={fieldWrap}>
                <label className={label}>Mechanical Seal Type</label>
                <select
                  className={control}
                  value={formData.sealingSubType}
                  onChange={(e) =>
                    setFormData({ ...formData, sealingSubType: e.target.value })
                  }
                >
                  <option value="">Select Seal Type</option>
                  {MECH_SEAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {sealDescription && <span className={hint}>{sealDescription}</span>}
              </div>

              <div className={fieldWrap}>
                <label className={label}>Seal MOC</label>
                <select
                  className={control}
                  value={formData.mechSealMoc ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, mechSealMoc: e.target.value })
                  }
                >
                  <option value="">Select MOC</option>
                  {MECH_SEAL_MOCS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>Seal Face</label>
                <select
                  className={control}
                  value={formData.mechSealFace ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, mechSealFace: e.target.value })
                  }
                >
                  <option value="">Select Face</option>
                  {MECH_SEAL_FACES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>Seal Make</label>
                <select
                  className={control}
                  value={formData.mechSealMake ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, mechSealMake: e.target.value })
                  }
                >
                  <option value="">Select Make</option>
                  {MECH_SEAL_MAKES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {isGlandPacking && (
            <>
              <div className={fieldWrap}>
                <label className={label}>Gland Packing Type</label>
                <select
                  className={control}
                  value={formData.glandPackingType ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, glandPackingType: e.target.value })
                  }
                >
                  <option value="">Select Packing Type</option>
                  {GLAND_PACKING_TYPES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>Gland Packing Make</label>
                <select
                  className={control}
                  value={formData.glandPackingMake ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, glandPackingMake: e.target.value })
                  }
                >
                  <option value="">Select Make</option>
                  {GLAND_PACKING_MAKES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
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
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default SealingDetailsStep;
