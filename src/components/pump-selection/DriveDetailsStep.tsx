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
                    available ratio ({num(vbelt.recommended.actualRpm)} rpm) was picked as
                    the next best.
                  </p>
                )}
              </>
            )}
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
