"use client";

import { useEffect, useState } from "react";
import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import { actions, btnGhost, btnPrimary, control, fieldWrap, grid, hint, label } from "./formStyles";
import { getVBeltDrive, type VBeltDrive } from "../../services/vbeltDriveService";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  onStepClick?: (step: number) => void;
};

type VbeltStatus = "idle" | "loading" | "ready" | "error";

const num = (n: number | null): string => (n === null ? "—" : String(n));

// Drive System input option lists (from the drive-selection spec sheet).
const MOTOR_MAKES = ["BBL", "Havells", "CGL", "ABB", "Siemens", "Other"];
const MOTOR_MOUNTINGS = [
  { value: "Foot B3", label: "Foot Mounted (B3)" },
 // { value: "Flange B5", label: "Flange Mounted (B5)" },
  //{ value: "Foot cum Flange B35", label: "Foot cum Flange (B35)" },
];
const STARTER_TYPES = ["Star-Delta", "DOL"];
const POWER_SUPPLIES = ["Single Phase", "Three Phase"];
const STD_OPTIONS = ["Standard", "Non-Standard"];

const DriveDetailsStep = ({
  onNext,
  onPrevious,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  const isVBelt = formData.driveSystem === "V-Belt Drive";
  const motorRpm = formData.motorRPM as string;

  const [vbeltStatus, setVbeltStatus] = useState<VbeltStatus>("idle");
  const [vbelt, setVbelt] = useState<VBeltDrive | null>(null);

  useEffect(() => {
    if (!isVBelt || !motorRpm || !formData.selectedModel || !formData.driveMotorKw) {
      setVbeltStatus("idle");
      setVbelt(null);
      return;
    }
    let cancelled = false;
    setVbeltStatus("loading");
    getVBeltDrive(formData, motorRpm)
      .then((res) => {
        if (cancelled) return;
        setVbelt(res);
        setVbeltStatus("ready");
        // Carry the recommended belt set into formData for the summary step.
        const r = res.recommended;
        setFormData((f: typeof formData) => ({
          ...f,
          driveVbeltGroove: res.grooves ?? "",
          drivePumpPulley: r?.pumpPulley != null ? String(r.pumpPulley) : "",
          driveMotorPulley: r?.motorPulley != null ? String(r.motorPulley) : "",
          driveVbeltRpm: r?.actualRpm != null ? String(r.actualRpm) : "",
          driveCenterDistance: r?.centerDistance != null ? String(r.centerDistance) : "",
          driveVbeltNo: r?.vBelt != null ? String(r.vBelt) : "",
        }));
      })
      .catch(() => {
        if (!cancelled) setVbeltStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isVBelt,
    motorRpm,
    formData.selectedModel,
    formData.driveMotorKw,
    formData.capacity,
    formData.capacityUnit,
    formData.head,
    formData.headUnit,
    formData.sg,
  ]);

  // "Drive Motor Speed" is the motor's nameplate RPM — default it from the
  // selected Motor RPM (960/1440), but leave it editable afterwards.
  useEffect(() => {
    if (isVBelt && motorRpm && !formData.driveMotorSpeed) {
      setFormData((f: typeof formData) => ({ ...f, driveMotorSpeed: motorRpm }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVBelt, motorRpm]);

  return (
    <div className="step-container">
      <Stepper currentStep={7} onStepClick={onStepClick} />

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

        {isVBelt && (
          <div className="mt-4 rounded-md border border-line bg-elev p-4">
            <span className="section-label">V-Belt Drive Recommendation</span>

            {vbeltStatus === "idle" && (
              <p className="mt-2 text-[13px] text-fg-3">
                Select a Motor RPM above to get the belt/pulley recommendation
                {!formData.driveMotorKw
                  ? " (also set the Drive Motor Rating on the Motor Rating step)."
                  : "."}
              </p>
            )}
            {vbeltStatus === "loading" && (
              <p className="mt-2 text-[13px] text-fg-3">Calculating belt drive…</p>
            )}
            {vbeltStatus === "error" && (
              <p className="mt-2 text-[13px] text-warn">
                Couldn&apos;t calculate the belt drive — check your connection and try again.
              </p>
            )}

            {vbeltStatus === "ready" && vbelt && !vbelt.recommended && (
              <p className="mt-2 text-[13px] text-warn">
                No V-belt/pulley data for {vbelt.model} at {vbelt.motorRpm} rpm /{" "}
                {vbelt.motorKw} kW — select the belt drive manually with engineering input.
              </p>
            )}

            {vbeltStatus === "ready" && vbelt && vbelt.recommended && (
              <>
                <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <span className="section-label">Groove</span>
                    <div className="mono text-[16px] font-semibold text-fg">
                      {vbelt.grooves ?? "—"}
                    </div>
                  </div>
                  <div>
                    <span className="section-label">Pump Pulley</span>
                    <div className="mono text-[16px] font-semibold text-fg">
                      {num(vbelt.recommended.pumpPulley)}
                    </div>
                  </div>
                  <div>
                    <span className="section-label">Motor Pulley</span>
                    <div className="mono text-[16px] font-semibold text-fg">
                      {num(vbelt.recommended.motorPulley)}
                    </div>
                  </div>
                  <div>
                    <span className="section-label">Pump RPM</span>
                    <div className="mono text-[16px] font-semibold text-fg">
                      {num(vbelt.recommended.actualRpm)}
                    </div>
                  </div>
                  <div>
                    <span className="section-label">Centre Distance</span>
                    <div className="mono text-[16px] font-semibold text-fg">
                      {num(vbelt.recommended.centerDistance)}
                    </div>
                  </div>
                  <div>
                    <span className="section-label">V-Belt No.</span>
                    <div className="mono text-[16px] font-semibold text-fg">
                      {num(vbelt.recommended.vBelt)}
                    </div>
                  </div>
                </div>

                <p className="mt-2 text-[12px] text-fg-3">
                  Pump&apos;s required speed window is{" "}
                  <b className="mono text-fg-2">
                    {vbelt.rpmLo.toFixed(0)}–{vbelt.rpmHi.toFixed(0)} rpm
                  </b>{" "}
                  (from its VE band at the duty point).
                </p>
                {!vbelt.withinRange && (
                  <p className="mt-1 text-[12px] text-warn">
                    No belt lands the pump exactly inside that window — the nearest
                    available belt (target {num(vbelt.recommended.targetRpm)} rpm) was
                    picked as the next best, giving a pump speed of{" "}
                    {num(vbelt.recommended.actualRpm)} rpm.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {isVBelt && (
          <div className="mt-4 rounded-md border border-line bg-elev p-4">
            <span className="section-label">Drive System Inputs</span>
            <div className={`${grid} mt-2`}>
              <div className={fieldWrap}>
                <label className={label}>Drive Motor Rating</label>
                <input
                  type="text"
                  readOnly
                  className={`${control} opacity-80`}
                  value={formData.driveMotorKw ? `${formData.driveMotorKw} kW` : ""}
                  placeholder="Set on the Motor Rating step"
                />
                <span className={hint}>Auto-filled from the Motor Rating step.</span>
              </div>

              <div className={fieldWrap}>
                <label className={label}>Drive Motor Speed (RPM)</label>
                <input
                  type="number"
                  step="any"
                  className={control}
                  placeholder="Motor nameplate RPM"
                  value={formData.driveMotorSpeed ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, driveMotorSpeed: e.target.value })
                  }
                />
              </div>

              <div className={fieldWrap}>
                <label className={label}>Drive Motor Make</label>
                <select
                  className={control}
                  value={formData.driveMotorMake ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, driveMotorMake: e.target.value })
                  }
                >
                  <option value="">Select Make</option>
                  {MOTOR_MAKES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>Motor Mounting</label>
                <select
                  className={control}
                  value={formData.driveMotorMounting ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, driveMotorMounting: e.target.value })
                  }
                >
                  <option value="">Select Mounting</option>
                  {MOTOR_MOUNTINGS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>Motor Type</label>
                <input
                  type="text"
                  className={control}
                  placeholder="e.g. IE3 / IP55 / 50 Hz / 415 V"
                  value={formData.driveMotorType ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, driveMotorType: e.target.value })
                  }
                />
              </div>

              <div className={fieldWrap}>
                <label className={label}>Starter Type</label>
                <select
                  className={control}
                  value={formData.driveStarterType ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, driveStarterType: e.target.value })
                  }
                >
                  <option value="">Select Starter</option>
                  {STARTER_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>Power Supply</label>
                <select
                  className={control}
                  value={formData.drivePowerSupply ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, drivePowerSupply: e.target.value })
                  }
                >
                  <option value="">Select Supply</option>
                  {POWER_SUPPLIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

            {/*  <div className={fieldWrap}>
                <label className={label}>Std / Non-Std</label>
                <select
                  className={control}
                  value={formData.driveStdNonStd ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, driveStdNonStd: e.target.value })
                  }
                >
                  <option value="">Select</option>
                  {STD_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>*/}
            </div>
          </div>
        )}

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
