"use client";

import { useEffect, useState } from "react";
import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import { actions, btnGhost, btnPrimary, control, fieldWrap, grid, hint, label } from "./formStyles";
import { getVBeltDrive, type VBeltDrive, type VBeltOption } from "../../services/vbeltDriveService";
import {
  getGearboxOptions,
  type GearboxOption,
  type GearboxRecommendation,
} from "../../services/gearboxOptionsService";
import { getRecommendations } from "../../services/recommendationService";
import type { PumpRecommendation } from "../../data/Recommendations";
import { toM3PerHr, toMwc } from "../../utils/units";

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
type GearboxStatus = "idle" | "loading" | "ready" | "error";

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

// Geared Motor Drive/Gear Box + Motor branch: "Gear Box + Motor" (separate
// units, coupled via 2 couplings, foot-mounted) vs "Geared Motor" (motor
// bolted directly onto the gearbox, 1 coupling on the pump side, flange
// mounted). Mounting + Coupling cascade off this choice — spec sheet values.
const GEARED_CONFIG_TYPES = ["Gear Box + Motor", "Geared Motor"];
// Values match the gear_box_type strings actually stored in
// pbl_gearbox/ptl_gearbox/top_gear_gearbox ("PLANTERY", not "PLANETARY").
const GB_CONSTRUCTION_TYPES = ["IN LINE HELICAL", "PLANTERY"];
const MOUNTING_BY_CONFIG: Record<string, { value: string; label: string }[]> = {
  "Gear Box + Motor": [{ value: "Foot Mount B3", label: "Foot Mount (B3)" }],
  "Geared Motor": [
    { value: "Flange Mount B5", label: "Flange Mount (B5)" },
    { value: "Foot cum Flange B35", label: "Foot cum Flange (B35)" },
  ],
};
const COUPLING_BY_CONFIG: Record<string, string> = {
  "Gear Box + Motor": "2 Drive + Driven Coupling",
  "Geared Motor": "1 Drive + Driven Coupling",
};

const DriveDetailsStep = ({
  onNext,
  onPrevious,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  const isVBelt = formData.driveSystem === "V-Belt Drive";
  const isGeared = formData.driveSystem === "Geared Motor Drive/Gear Box + Motor";
  const motorRpm = formData.motorRPM as string;

  // Recheck modal: computes the actual delivered capacity + BKW at the
  // drive-achieved pump RPM (v-belt actual RPM, gearbox output RPM, or motor
  // RPM for direct drive) using the pump's own qth/VE/ME. Fetched lazily on
  // first Recheck click via getRecommendations — kept out of the mount effect
  // so it doesn't hit the API for users who don't open the modal.
  const [showRecheck, setShowRecheck] = useState(false);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckError, setRecheckError] = useState<string | null>(null);
  const [pumpSpecs, setPumpSpecs] = useState<PumpRecommendation | null>(null);

  const finalPumpRpmRaw: string = isVBelt
    ? (formData.driveVbeltRpm as string) || ""
    : isGeared
      ? (formData.gearboxOutputRpm as string) || ""
      : (motorRpm as string) || "";
  const finalPumpRpmSource: string = isVBelt
    ? "V-Belt achieved pump RPM"
    : isGeared
      ? "Gearbox output RPM"
      : "Motor RPM (direct drive)";

  const handleRecheck = async () => {
    setRecheckError(null);
    if (!formData.selectedModel) {
      setRecheckError("Confirm a pump model first.");
      setShowRecheck(true);
      return;
    }
    if (!formData.driveSystem) {
      setRecheckError("Pick a drive system first.");
      setShowRecheck(true);
      return;
    }
    if (!finalPumpRpmRaw) {
      setRecheckError(
        isVBelt
          ? "Pick a V-Belt option first — final pump RPM comes from the belt selection."
          : isGeared
            ? "Pick a gearbox first — final pump RPM comes from the gearbox output."
            : "Motor RPM is required.",
      );
      setShowRecheck(true);
      return;
    }
    setRecheckLoading(true);
    setShowRecheck(true);
    try {
      const { recommendations } = await getRecommendations(formData);
      const match = recommendations.find((p) => p.model === formData.selectedModel);
      if (!match) {
        setRecheckError(
          "Couldn't find the confirmed pump in the current recommendation set — it may no longer satisfy the entered duty point.",
        );
        setPumpSpecs(null);
      } else {
        setPumpSpecs(match);
      }
    } catch {
      setRecheckError("Couldn't load pump specifications. Check your connection and try again.");
      setPumpSpecs(null);
    } finally {
      setRecheckLoading(false);
    }
  };

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

  // Manual belt pick — clicking a candidate card records its details into
  // formData for the summary step. No auto-selection on fetch (per spec).
  const selectVBelt = (grooves: string | null, opt: VBeltOption) => {
    setFormData({
      ...formData,
      driveVbeltGroove: grooves ?? "",
      drivePumpPulley: opt.pumpPulley != null ? String(opt.pumpPulley) : "",
      driveMotorPulley: opt.motorPulley != null ? String(opt.motorPulley) : "",
      driveVbeltRpm: opt.actualRpm != null ? String(opt.actualRpm) : "",
      driveCenterDistance: opt.centerDistance != null ? String(opt.centerDistance) : "",
      driveVbeltNo: opt.vBelt != null ? String(opt.vBelt) : "",
    });
  };

  // "Drive Motor Speed" is the motor's nameplate RPM — default it from the
  // selected Motor RPM (960/1440), but leave it editable afterwards.
  useEffect(() => {
    if (isVBelt && motorRpm && !formData.driveMotorSpeed) {
      setFormData((f: typeof formData) => ({ ...f, driveMotorSpeed: motorRpm }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVBelt, motorRpm]);

  // Gearbox recommendation (PBL/PTL/Top Gear), only once a model + duty point
  // + the Motor Rating step's KW are known. Re-screens whenever ASF Range or
  // GB Type change too — those narrow the already-fetched candidate set.
  const [gearboxStatus, setGearboxStatus] = useState<GearboxStatus>("idle");
  const [gearboxRec, setGearboxRec] = useState<GearboxRecommendation | null>(null);

  useEffect(() => {
    if (!isGeared || !formData.selectedModel || !formData.driveMotorKw) {
      setGearboxStatus("idle");
      setGearboxRec(null);
      return;
    }
    let cancelled = false;
    setGearboxStatus("loading");
    getGearboxOptions(formData)
      .then((res) => {
        if (cancelled) return;
        setGearboxRec(res);
        setGearboxStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setGearboxStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isGeared,
    formData.selectedModel,
    formData.driveMotorKw,
    formData.capacity,
    formData.capacityUnit,
    formData.head,
    formData.headUnit,
    formData.sg,
    formData.asfRange,
    formData.gbConstructionType,
  ]);

  const selectGearbox = (source: "PBL" | "PTL" | "Top Gear", opt: GearboxOption) => {
    setFormData({
      ...formData,
      gearboxSource: source,
      gearboxModel: opt.model,
      gearboxOutputRpm: String(opt.outputRpm),
      gearboxServiceFactor: opt.serviceFactor != null ? String(opt.serviceFactor) : "",
      gearboxRatePerNos: opt.ratePerNos != null ? String(opt.ratePerNos) : "",
    });
  };

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
              onChange={(e) => {
                const nextDrive = e.target.value;
                const isGeared = nextDrive === "Geared Motor Drive/Gear Box + Motor";
                setFormData({
                  ...formData,
                  driveSystem: nextDrive,
                  // Motor RPM: fixed 1440 for the Geared option (only one
                  // supported gear-motor speed); cleared when no drive is
                  // selected; preserved when switching between Direct/V-Belt.
                  motorRPM: isGeared
                    ? "1440"
                    : nextDrive === ""
                      ? ""
                      : formData.motorRPM,
                  gearBoxType: isGeared ? formData.gearBoxType : "",
                  gearBoxMounting: isGeared ? formData.gearBoxMounting : "",
                  asfRange: isGeared ? formData.asfRange : "",
                });
              }}
            >
              <option value="">Select Drive System</option>
              <option value="Direct Drive">Direct Drive</option>
              <option value="V-Belt Drive">V-Belt Drive</option>
              <option value="Geared Motor Drive/Gear Box + Motor">
                Geared Motor Drive/Gear Box + Motor
              </option>
            </select>
          </div>

          {/* Motor RPM: only relevant after a drive system is picked. For the
              Geared option it's fixed at 1440 (shown read-only). */}
          {formData.driveSystem && (
            <div className={fieldWrap}>
              <label className={label}>Motor RPM</label>
              {formData.driveSystem === "Geared Motor Drive/Gear Box + Motor" ? (
                <input
                  type="text"
                  readOnly
                  className={`${control} opacity-80`}
                  value="1440"
                />
              ) : (
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
              )}
            </div>
          )}

          {formData.driveSystem === "Geared Motor Drive/Gear Box + Motor" && (
            <>
              <div className={fieldWrap}>
                <label className={label}>Configuration</label>
                <select
                  className={control}
                  value={formData.gearedConfigType ?? ""}
                  onChange={(e) => {
                    const nextConfig = e.target.value;
                    const mountingOptions = MOUNTING_BY_CONFIG[nextConfig] ?? [];
                    setFormData({
                      ...formData,
                      gearedConfigType: nextConfig,
                      // "Gear Box + Motor" has exactly one valid mounting —
                      // auto-fill it. "Geared Motor" has 2 real options, so
                      // let the user pick (clear unless the current value is
                      // still valid for the new config).
                      gearBoxMounting:
                        mountingOptions.length === 1
                          ? mountingOptions[0].value
                          : mountingOptions.some((m) => m.value === formData.gearBoxMounting)
                            ? formData.gearBoxMounting
                            : "",
                      // Coupling is always fully determined by the config —
                      // never a free user choice.
                      driveCoupling: COUPLING_BY_CONFIG[nextConfig] ?? "",
                    });
                  }}
                >
                  <option value="">Select Configuration</option>
                  {GEARED_CONFIG_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>Selected Motor KW</label>
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
                <label className={label}>Gear Box Shaft Type</label>
                <select
                  className={control}
                  value={formData.gearBoxType}
                  onChange={(e) =>
                    setFormData({ ...formData, gearBoxType: e.target.value })
                  }
                >
                  <option value="">Select Gear Box Shaft Type</option>
                  <option value="HISO">HISO (Hollow Input Solid Output)</option>
                  <option value="SISO">SISO (Solid Input Solid Output)</option>
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>GB Type</label>
                <select
                  className={control}
                  value={formData.gbConstructionType ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, gbConstructionType: e.target.value })
                  }
                >
                  <option value="">Select GB Type</option>
                  {GB_CONSTRUCTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>Gear Box Mounting</label>
                {!formData.gearedConfigType ? (
                  <select className={control} value="" disabled>
                    <option value="">Select Configuration first</option>
                  </select>
                ) : formData.gearedConfigType === "Gear Box + Motor" ? (
                  <input
                    type="text"
                    readOnly
                    className={`${control} opacity-80`}
                    value="Foot Mount (B3)"
                  />
                ) : (
                  <select
                    className={control}
                    value={formData.gearBoxMounting}
                    onChange={(e) =>
                      setFormData({ ...formData, gearBoxMounting: e.target.value })
                    }
                  >
                    <option value="">Select Mounting</option>
                    {MOUNTING_BY_CONFIG[formData.gearedConfigType].map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className={fieldWrap}>
                <label className={label}>Coupling</label>
                <input
                  type="text"
                  readOnly
                  className={`${control} opacity-80`}
                  value={formData.driveCoupling ?? ""}
                  placeholder="Select Configuration first"
                />
                <span className={hint}>Derived from the Configuration selected above.</span>
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
                  <option value="2+">2 &amp; Above</option>
                </select>
              </div>
            </>
          )}
        </div>

        {isGeared && (
          <div className="mt-4 rounded-md border border-line bg-elev p-4">
            <span className="section-label">Gearbox Recommendation</span>

            {gearboxStatus === "idle" && (
              <p className="mt-2 text-[13px] text-fg-3">
                Set the Drive Motor Rating on the Motor Rating step to see gearbox
                candidates from PBL, PTL, and Top Gear.
              </p>
            )}
            {gearboxStatus === "loading" && (
              <p className="mt-2 text-[13px] text-fg-3">Screening gearbox candidates…</p>
            )}
            {gearboxStatus === "error" && (
              <p className="mt-2 text-[13px] text-warn">
                Couldn&apos;t load gearbox candidates — check your connection and try again.
              </p>
            )}

            {gearboxStatus === "ready" && gearboxRec && (
              <>
                <p className="mt-2 text-[12px] text-fg-3">
                  Pump&apos;s required speed window is{" "}
                  <b className="mono text-fg-2">
                    {gearboxRec.rpmLo.toFixed(0)}–{gearboxRec.rpmHi.toFixed(0)} rpm
                  </b>{" "}
                  — screened here ±20%:{" "}
                  <b className="mono text-fg-2">
                    {gearboxRec.rpmLoPadded.toFixed(0)}–{gearboxRec.rpmHiPadded.toFixed(0)} rpm
                  </b>{" "}
                  at <b className="mono text-fg-2">{gearboxRec.motorKw} kW</b>.
                  {(formData.asfRange || formData.gbConstructionType) && (
                    <>
                      {" "}Narrowed by
                      {formData.asfRange ? ` ASF ${formData.asfRange}` : ""}
                      {formData.asfRange && formData.gbConstructionType ? " and" : ""}
                      {formData.gbConstructionType ? ` GB Type ${formData.gbConstructionType}` : ""}.
                    </>
                  )}
                </p>

                {gearboxRec.pbl.length === 0 &&
                  gearboxRec.ptl.length === 0 &&
                  gearboxRec.topGear.length === 0 && (
                    <p className="mt-2 text-[13px] text-warn">
                      No gearbox options match this window/KW
                      {formData.asfRange || formData.gbConstructionType
                        ? " with the current ASF Range/GB Type narrowing — try clearing one."
                        : "."}
                    </p>
                  )}

                {(
                  [
                    ["PBL", gearboxRec.pbl],
                    ["PTL", gearboxRec.ptl],
                    ["Top Gear", gearboxRec.topGear],
                  ] as [ "PBL" | "PTL" | "Top Gear", GearboxOption[] ][]
                ).map(
                  ([source, opts]) =>
                    opts.length > 0 && (
                    <div key={source} className="mt-4">
  <span className="section-label text-orange-800">{source}</span>

  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
    {opts.map((o) => {
      const isSelected =
        formData.gearboxSource === source &&
        formData.gearboxModel === o.model &&
        formData.gearboxOutputRpm === String(o.outputRpm);

      return (
        <button
          type="button"
          key={o.id}
          onClick={() => selectGearbox(source, o)}
          className={`group rounded-xl border p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            isSelected
              ? "border-orange-400 bg-orange-100 ring-2 ring-orange-300"
              : "border-orange-200 bg-orange-50 hover:border-orange-300 hover:bg-orange-100"
          }`}
        >
          <div className="flex items-center justify-between">
            <strong className="mono text-[14px] font-bold text-orange-900">
              {o.model}
            </strong>

            {isSelected && (
              <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                ✓ Selected
              </span>
            )}
          </div>

          <div className="mt-3 rounded-lg bg-white/70 p-2">
            <div className="flex justify-between text-[12px]">
              <span className="text-slate-500">Output RPM</span>
              <b className="mono text-slate-800">{o.outputRpm}</b>
            </div>

            <div className="mt-1 flex justify-between text-[12px]">
              <span className="text-slate-500">Service Factor</span>
              <b className="mono text-slate-800">{num(o.serviceFactor)}</b>
            </div>

            <div className="mt-2 border-t border-orange-200 pt-2">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">Rate</span>
                <b className="mono text-slate-800">{num(o.ratePerNos)}</b>
              </div>
            </div>
          </div>
        </button>
      );
    })}
  </div>
</div>
                    ),
                )}
              </>
            )}
          </div>
        )}

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

            {vbeltStatus === "ready" && vbelt && vbelt.candidates.length === 0 && (
              <p className="mt-2 text-[13px] text-warn">
                No V-belt/pulley data for {vbelt.model} at {vbelt.motorRpm} rpm /{" "}
                {vbelt.motorKw} kW — select the belt drive manually with engineering input.
              </p>
            )}

            {vbeltStatus === "ready" && vbelt && vbelt.candidates.length > 0 && (
              <>
                <p className="mt-2 text-[12px] text-fg-3">
                  Pump&apos;s required speed window is{" "}
                  <b className="mono text-fg-2">
                    {vbelt.rpmLo.toFixed(0)}–{vbelt.rpmHi.toFixed(0)} rpm
                  </b>{" "}
                  (from its VE band at the duty point). Groove{" "}
                  <b className="mono text-fg-2 bg-orange-100 px-2 py-1">
                    {vbelt.grooves ?? "—"}
                  </b>.
                </p>
                {!vbelt.withinRange && (
                  <p className="mt-1 text-[12px] text-warn">
                    No belt lands the pump exactly inside that window — showing the
                    nearest available belt as the next best.
                  </p>
                )}

                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
  {vbelt.candidates.map((o) => {
    const isSelected =
      formData.driveVbeltGroove === (vbelt.grooves ?? "") &&
      formData.drivePumpPulley ===
        (o.pumpPulley != null ? String(o.pumpPulley) : "") &&
      formData.driveVbeltRpm ===
        (o.actualRpm != null ? String(o.actualRpm) : "") &&
      formData.driveVbeltNo ===
        (o.vBelt != null ? String(o.vBelt) : "");

    return (
      <button
        type="button"
        key={o.targetRpm}
        onClick={() => selectVBelt(vbelt.grooves, o)}
        className={`group rounded-xl border p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
          isSelected
            ? "border-orange-400 bg-orange-100 ring-2 ring-orange-300"
            : "border-orange-200 bg-orange-50 hover:border-orange-300 hover:bg-orange-100"
        }`}
      >
        <div className="flex items-center justify-between">
          <strong className="mono text-[14px] font-bold text-orange-900">
            {num(o.actualRpm)} RPM
          </strong>

          {isSelected && (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white">
              ✓ Selected
            </span>
          )}
        </div>

        <div className="mt-3 rounded-lg bg-white/70 p-2">
          <div className="flex justify-between text-[12px]">
            <span className="text-slate-500">Pump Pulley</span>
            <b className="mono text-slate-800">{num(o.pumpPulley)}</b>
          </div>

          <div className="mt-1 flex justify-between text-[12px]">
            <span className="text-slate-500">Motor Pulley</span>
            <b className="mono text-slate-800">{num(o.motorPulley)}</b>
          </div>

          <div className="mt-2 border-t border-orange-200 pt-2">
            <div className="flex justify-between text-[12px]">
              <span className="text-slate-500">Centre Distance</span>
              <b className="mono text-slate-800">
                {num(o.centerDistance)}
              </b>
            </div>

            <div className="mt-1 flex justify-between text-[12px]">
              <span className="text-slate-500">V-Belt</span>
              <b className="mono text-slate-800">{num(o.vBelt)}</b>
            </div>
          </div>
        </div>
      </button>
    );
  })}
</div>
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
                <label className={label}>Efficiency</label>
                <input
                  type="text"
                  className={control}
                  placeholder="e.g. IE3"
                  value={formData.driveMotorEfficiency ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, driveMotorEfficiency: e.target.value })
                  }
                />
              </div>

              <div className={fieldWrap}>
                <label className={label}>Protection</label>
                <input
                  type="text"
                  className={control}
                  placeholder="e.g. IP55"
                  value={formData.driveMotorProtection ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, driveMotorProtection: e.target.value })
                  }
                />
              </div>

              <div className={fieldWrap}>
                <label className={label}>Frequency</label>
                <input
                  type="text"
                  className={control}
                  placeholder="e.g. 50 Hz"
                  value={formData.driveMotorFrequency ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, driveMotorFrequency: e.target.value })
                  }
                />
              </div>

              <div className={fieldWrap}>
                <label className={label}>Voltage</label>
                <input
                  type="text"
                  className={control}
                  placeholder="e.g. 415 V"
                  value={formData.driveMotorVoltage ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, driveMotorVoltage: e.target.value })
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
          <button className={btnPrimary} onClick={handleRecheck}>
            Recheck
          </button>
        </div>
      </div>

      {showRecheck && (
        <RecheckModal
          loading={recheckLoading}
          error={recheckError}
          pumpSpecs={pumpSpecs}
          finalRpm={finalPumpRpmRaw}
          finalRpmSource={finalPumpRpmSource}
          formData={formData}
          onClose={() => setShowRecheck(false)}
          onProceed={() => {
            setShowRecheck(false);
            onNext();
          }}
        />
      )}
    </div>
  );
};

// --- Recheck modal ---------------------------------------------------------
// Recomputes the delivered capacity + BKW at the drive-achieved pump RPM
// (not the entered duty capacity) so the engineer can see whether the
// selected drive actually lands close to the duty point. Formulas match
// recommendation-engine.ts:
//   Q (at 100 rpm, per VE) = qth × VE/100
//   Cap at final RPM       = Q × final_rpm / 100
//   BKW                    = Cap × head(MWC) / 367 / (ME/100)
//   Motor KW               = BKW × 1.2

type RecheckModalProps = {
  loading: boolean;
  error: string | null;
  pumpSpecs: PumpRecommendation | null;
  finalRpm: string;
  finalRpmSource: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  onClose: () => void;
  onProceed: () => void;
};

const fmtNum = (n: number, dp = 2): string =>
  Number.isFinite(n) ? n.toFixed(dp) : "—";

const RecheckModal = ({
  loading,
  error,
  pumpSpecs,
  finalRpm,
  finalRpmSource,
  formData,
  onClose,
  onProceed,
}: RecheckModalProps) => {
  const finalRpmNum = Number(finalRpm);
  const sg = Number(formData.sg) || 1;
  const headMwc = formData.head
    ? toMwc(Number(formData.head), formData.headUnit || "MWC", sg)
    : NaN;
  const dutyCap = formData.capacity
    ? toM3PerHr(Number(formData.capacity), formData.capacityUnit || "m3/hr", sg)
    : NaN;

  const canCompute =
    pumpSpecs !== null &&
    Number.isFinite(finalRpmNum) &&
    finalRpmNum > 0 &&
    Number.isFinite(headMwc);

  let calc: {
    qAtMax: number;
    qAtMin: number;
    capAtMax: number;
    capAtMin: number;
    bkwAtMax: number;
    bkwAtMin: number;
    motorKwAtMax: number;
    motorKwAtMin: number;
  } | null = null;

  if (canCompute && pumpSpecs) {
    const qth = pumpSpecs.qth;
    const veMax = pumpSpecs.voleMax;
    const veMin = pumpSpecs.voleMin;
    const me = pumpSpecs.mechEff;
    const qAtMax = qth * (veMax / 100);
    const qAtMin = qth * (veMin / 100);
    const capAtMax = (qAtMax * finalRpmNum) / 100;
    const capAtMin = (qAtMin * finalRpmNum) / 100;
    const bkwAtMax = me > 0 ? (capAtMax * headMwc) / 367 / (me / 100) : NaN;
    const bkwAtMin = me > 0 ? (capAtMin * headMwc) / 367 / (me / 100) : NaN;
    calc = {
      qAtMax,
      qAtMin,
      capAtMax,
      capAtMin,
      bkwAtMax,
      bkwAtMin,
      motorKwAtMax: bkwAtMax * 1.2,
      motorKwAtMin: bkwAtMin * 1.2,
    };
  }

  const selectedMotorKw = Number(formData.driveMotorKw) || null;
  const motorKwWarning =
    calc && selectedMotorKw !== null
      ? Math.max(calc.motorKwAtMax, calc.motorKwAtMin) > selectedMotorKw
      : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-lg bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <h3 className="text-base font-semibold text-fg">
              Recheck at final selected RPM
            </h3>
            <p className="mt-0.5 text-xs text-fg-3">
              Delivered capacity &amp; BKW recomputed at the drive-achieved pump RPM.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-fg-3 hover:bg-elev hover:text-fg"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {loading && (
            <p className="text-[13px] text-fg-3">Loading pump specifications…</p>
          )}
          {!loading && error && (
            <p className="text-[13px] text-warn">{error}</p>
          )}
          {!loading && !error && !canCompute && (
            <p className="text-[13px] text-warn">
              Not enough data to recompute — need pump specs, head, and final pump RPM.
            </p>
          )}

          {!loading && !error && canCompute && calc && pumpSpecs && (
            <>
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full text-[13px]">
                  <tbody>
                    <RecheckRow label={finalRpmSource} value={String(finalRpmNum)} />
                    <RecheckRow label="Pump Model" value={pumpSpecs.model} />
                    <RecheckRow
                      label="Head"
                      value={`${fmtNum(headMwc, 2)} MWC`}
                      note={
                        formData.headUnit && formData.headUnit !== "MWC"
                          ? `entered: ${formData.head} ${formData.headUnit}`
                          : undefined
                      }
                    />
                    <RecheckRow
                      label="Duty Capacity (entered)"
                      value={`${fmtNum(dutyCap, 2)} m³/hr`}
                    />
                    <RecheckRow label="VE min / max (%)" value={`${pumpSpecs.voleMin} / ${pumpSpecs.voleMax}`} />
                    <RecheckRow label="ME (%)" value={String(pumpSpecs.mechEff)} note="Depends on the head" />
                    <RecheckRow label="Q th" value={fmtNum(pumpSpecs.qth, 2)} />
                  </tbody>
                </table>
              </div>

              <div className="mt-4 overflow-x-auto rounded-md border border-line">
                <table className="w-full text-[13px]">
                  <thead className="bg-elev text-left text-[11px] uppercase tracking-wide text-fg-3">
                    <tr>
                      <th className="px-3 py-2">At VE</th>
                      <th className="px-3 py-2 text-right">VE max ({pumpSpecs.voleMax}%)</th>
                      <th className="px-3 py-2 text-right">VE min ({pumpSpecs.voleMin}%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <RecheckCalcRow
                      label="Q"
                      hi={calc.qAtMax}
                      lo={calc.qAtMin}
                    />
                    <RecheckCalcRow
                      label={`Cap at ${finalRpmNum} rpm (Q × RPM/100)`}
                      hi={calc.capAtMax}
                      lo={calc.capAtMin}
                      highlight
                      unit="m³/hr"
                    />
                    <RecheckCalcRow
                      label="BKW = Cap × Head / 367 / (ME/100)"
                      hi={calc.bkwAtMax}
                      lo={calc.bkwAtMin}
                      unit="kW"
                    />
                  </tbody>
                </table>
              </div>

              {selectedMotorKw !== null && (
                <p
                  className={`mt-3 text-[12px] ${
                    motorKwWarning ? "text-warn" : "text-fg-3"
                  }`}
                >
                  Selected Motor KW: <strong>{selectedMotorKw} kW</strong>
                  {motorKwWarning
                    ? " — recomputed Motor KW exceeds this. Consider a higher rating."
                    : " — recomputed Motor KW fits within this."}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button
            className={btnPrimary}
            onClick={onProceed}
            disabled={loading || !canCompute}
          >
            Get Recommendation
          </button>
        </div>
      </div>
    </div>
  );
};

const RecheckRow = ({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) => (
  <tr className="border-t border-line first:border-t-0">
    <td className="px-3 py-2 font-medium text-fg">{label}</td>
    <td className="px-3 py-2 text-right font-mono text-fg">
      {value}
      {note && <span className="ml-2 font-sans text-[11px] text-fg-3">({note})</span>}
    </td>
  </tr>
);

const RecheckCalcRow = ({
  label,
  hi,
  lo,
  unit,
  highlight,
}: {
  label: string;
  hi: number;
  lo: number;
  unit?: string;
  highlight?: boolean;
}) => (
  <tr className={`border-t border-line ${highlight ? "bg-[var(--pos-soft)]" : ""}`}>
    <td className="px-3 py-2 text-fg">{label}</td>
    <td className={`px-3 py-2 text-right font-mono ${highlight ? "font-semibold text-[var(--pos-strong)]" : "text-fg"}`}>
      {fmtNum(hi)} {unit ?? ""}
    </td>
    <td className={`px-3 py-2 text-right font-mono ${highlight ? "font-semibold text-[var(--pos-strong)]" : "text-fg"}`}>
      {fmtNum(lo)} {unit ?? ""}
    </td>
  </tr>
);

export default DriveDetailsStep;
