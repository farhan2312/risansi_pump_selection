"use client";

import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import PumpDetailsCard from "../../components/recommendation/PumpDetailsCard";
import TestReportModal from "../../components/recommendation/TestReportModal";
import { useEffect, useState } from "react";
import { getRecommendations } from "../../services/recommendationService";
import { SIZE_COLUMN_BY_RANGE, sizeForViscosityRange } from "../../lib/suction-discharge-size";
import type {
  PumpRecommendation,
  PumpSelectionFormData,
} from "../../data/Recommendations";

type Props = {
  onPrevious: () => void;
  formData: PumpSelectionFormData;
  selectedPump: number | null;
  setSelectedPump: React.Dispatch<React.SetStateAction<number | null>>;
  onStepClick?: (step: number) => void;
};

// Combines a manual material selection with its open-remarks note into one
// summary line, e.g. "SS304 (verify with client spec)".
const withRemarks = (value?: string, remarks?: string): string | undefined => {
  if (!value) return undefined;
  return remarks ? `${value} (${remarks})` : value;
};

const RPM_RANGE_LABELS: Record<string, string> = {
  low: "Low (< 200)",
  medium: "Medium (200–320)",
  high: "High (320–400)",
  vhigh: "Very High (> 400)",
};

type FieldItem = [string, string | undefined];

// One labeled value pair, filtered to only the ones with a real value —
// used inside every report section box below.
const FieldGrid = ({ items, tone = "default" }: { items: FieldItem[]; tone?: "default" | "pos" }) => {
  const filled = items.filter(([, v]) => v && String(v).trim() !== "");
  if (filled.length === 0) return null;
  const labelClass = tone === "pos" ? "text-[var(--pos-strong)]/75" : "text-fg-3";
  const valueClass = tone === "pos" ? "text-[var(--pos-strong)]" : "text-fg";
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {filled.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <span className={`text-[11px] uppercase tracking-wide ${labelClass}`}>{label}</span>
          <strong className={`text-[13.5px] font-semibold ${valueClass}`}>{value}</strong>
        </div>
      ))}
    </div>
  );
};

// Only used to decide whether to render a Section at all (Section itself
// re-filters via FieldGrid) — avoids an empty bordered box for a step the
// user hasn't touched.
const hasAny = (items: FieldItem[]) => items.some(([, v]) => v && String(v).trim() !== "");

// One step's box: label header + its field grid. Renders nothing if every
// field in `items` is empty, so untouched steps don't leave a hollow box.
const Section = ({
  title,
  items,
  children,
}: {
  title: string;
  items?: FieldItem[];
  children?: React.ReactNode;
}) => {
  if (items && !hasAny(items) && !children) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line bg-paper">
      <div className="border-b border-line bg-elev px-4 py-2.5">
        <span className="section-label">{title}</span>
      </div>
      <div className="p-4">
        {items && <FieldGrid items={items} />}
        {children}
      </div>
    </div>
  );
};

// Read-only summary step: the pump model was already picked + confirmed after
// the Fluid step, so this just reviews the confirmed model and every spec
// configured along the way. No re-picking here.
const RecommendationStep = ({ onPrevious, formData, onStepClick }: Props) => {
  const [showReport, setShowReport] = useState(false);
  const [recommendations, setRecommendations] = useState<PumpRecommendation[]>([]);
  const [inputEcho, setInputEcho] = useState<{ capacity: string; head: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getRecommendations(formData)
      .then((result) => {
        if (!cancelled) {
          setRecommendations(result.recommendations);
          setInputEcho(result.input);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Couldn't load the pump summary. Please check your connection and try again."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmedPump =
    recommendations.find((p) => p.model === formData.selectedModel) || null;

  // --- Field groups, one per wizard step, in wizard order ------------------

  const generalInfoItems: FieldItem[] = [
    ["Media / Application", formData.media],
    ["Capacity", formData.capacity ? `${formData.capacity} ${formData.capacityUnit || ""}`.trim() : ""],
    ["Head", formData.head ? `${formData.head} ${formData.headUnit || ""}`.trim() : ""],
    ["Temperature", formData.temperature ? `${formData.temperature} °C` : ""],
    ["pH", formData.ph],
    ["Specific Gravity", formData.sg],
    ["RPM Range", formData.rpmRange ? RPM_RANGE_LABELS[formData.rpmRange] ?? formData.rpmRange : ""],
  ];

  const fluidPropertiesItems: FieldItem[] = [
    ["Viscosity", formData.viscosity ? `${formData.viscosity} ${formData.viscosityUnit || ""}`.trim() : ""],
    ["Solids", formData.solidPercentage ? `${formData.solidPercentage}%` : ""],
    [
      "Particle Size",
      formData.solidSize
        ? `${formData.solidSize} mm${formData.solidType ? ` (${formData.solidType})` : ""}`
        : "",
    ],
  ];

  const operatingConditionsItems: FieldItem[] = [
    ["Pump Type", formData.pumpType],
    ["AG / BK", formData.agBk],
    ["Bearing Housing", formData.bearingHousing],
    ["Suction Housing", formData.suctionHousing],
    ["Joint Type", formData.jointType],
  ];

  const mocItems: FieldItem[] = [
    ["Bearing Housing MOC", withRemarks(formData.mocAiBearingHousing, formData.mocAiBearingHousingRemarks)],
    ["Bearing Plate MOC", withRemarks(formData.mocAiBearingPlate, formData.mocAiBearingPlateRemarks)],
    ["Tie Rod MOC", withRemarks(formData.mocAiTieRod, formData.mocAiTieRodRemarks)],
    ["Nut & Bolt MOC", withRemarks(formData.mocAiNutBolt, formData.mocAiNutBoltRemarks)],
    ["Pump Housing MOC", withRemarks(formData.mocAiPumpHousing, formData.mocAiPumpHousingRemarks)],
    ["Rotor MOC", withRemarks(formData.mocAiRotor, formData.mocAiRotorRemarks)],
    ["Shaft MOC", withRemarks(formData.mocAiShaft, formData.mocAiShaftRemarks)],
    ["Stator Rubber", withRemarks(formData.mocAiStatorRubber, formData.mocAiStatorRubberRemarks)],
  ];

  const sealingItems: FieldItem[] = [
    ["Sealing Type", formData.sealingType],
    ["Mechanical Seal Type", formData.sealingSubType],
  ];

  const motorRatingItems: FieldItem[] = [
    ["Drive Motor Rating", formData.driveMotorKw ? `${formData.driveMotorKw} kW` : ""],
  ];

  const driveCommonItems: FieldItem[] = [
    ["Drive System", formData.driveSystem],
    ["Motor RPM", formData.motorRPM],
  ];

  const isVBelt = formData.driveSystem === "V-Belt Drive";
  const isGeared = formData.driveSystem === "Geared Motor Drive/Gear Box + Motor";

  // The specific option actually picked on the Drive step — highlighted in
  // the report's positive/confirmed green, same convention as the MOC AI
  // recommendation cells, so the one real selection stands out from the
  // surrounding read-only spec fields.
  const vbeltSelectedItems: FieldItem[] = [
    ["V-Belt Groove", formData.driveVbeltGroove],
    ["Pump Pulley", formData.drivePumpPulley],
    ["Motor Pulley", formData.driveMotorPulley],
    ["Achieved Pump RPM", formData.driveVbeltRpm],
    ["Centre Distance", formData.driveCenterDistance],
    ["V-Belt No.", formData.driveVbeltNo],
  ];
  const vbeltInputItems: FieldItem[] = [
    ["Drive Motor Speed", formData.driveMotorSpeed ? `${formData.driveMotorSpeed} RPM` : ""],
    ["Drive Motor Make", formData.driveMotorMake],
    ["Motor Mounting", formData.driveMotorMounting],
    ["Efficiency", formData.driveMotorEfficiency],
    ["Protection", formData.driveMotorProtection],
    ["Frequency", formData.driveMotorFrequency],
    ["Voltage", formData.driveMotorVoltage],
    ["Starter Type", formData.driveStarterType],
    ["Power Supply", formData.drivePowerSupply],
    ["Std / Non-Std", formData.driveStdNonStd],
  ];

  const gearedSelectedItems: FieldItem[] = [
    ["Gearbox Source", formData.gearboxSource],
    ["Gearbox Model", formData.gearboxModel],
    ["Gearbox Output RPM", formData.gearboxOutputRpm],
    ["Gearbox Service Factor", formData.gearboxServiceFactor],
    ["Gearbox Rate", formData.gearboxRatePerNos],
  ];
  const gearedInputItems: FieldItem[] = [
    ["Configuration", formData.gearedConfigType],
    ["Gear Box Shaft Type", formData.gearBoxType],
    ["GB Type", formData.gbConstructionType],
    ["Gear Box Mounting", formData.gearBoxMounting],
    ["Coupling", formData.driveCoupling],
    ["ASF Range", formData.asfRange],
  ];

  const driveSelectedItems = isVBelt ? vbeltSelectedItems : isGeared ? gearedSelectedItems : [];
  const driveInputItems = isVBelt ? vbeltInputItems : isGeared ? gearedInputItems : [];
  const driveHasAnything =
    hasAny(driveCommonItems) || hasAny(driveSelectedItems) || hasAny(driveInputItems);

  return (
    <div className="step-container">
      <Stepper currentStep={8} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Selection Summary</h2>

        <p>
          Review your confirmed pump and its configuration. Go back to any step to
          change something.
          {inputEcho && (
            <>
              {" "}
              (Capacity: <strong>{inputEcho.capacity}</strong>, Head:{" "}
              <strong>{inputEcho.head}</strong>)
            </>
          )}
        </p>

        {isLoading && <p>Loading summary…</p>}

        {error && <p className="error-message">{error}</p>}

        {!isLoading && !error && !confirmedPump && (
          <p>
            No confirmed pump model found for these inputs. Go back and confirm a model
            in the recommendation panel.
          </p>
        )}

        {!isLoading && !error && confirmedPump && (
          <>
            {/* Pump selection at the very top — the anchor of the report. */}
            {(() => {
              // Prefer the confirmed model's own per-viscosity size; fall back
              // to the flat SIZE_BY_RANGE hint when the model isn't covered by
              // the per-model sheet (mostly L-variants).
              const col = SIZE_COLUMN_BY_RANGE[formData.viscosityRange as string];
              const perModel = col ? confirmedPump[col] : null;
              const cardSize =
                perModel ?? sizeForViscosityRange(formData.viscosityRange);
              return (
                <PumpDetailsCard
                  pump={confirmedPump}
                  size={cardSize}
                  pumpType={formData.pumpType}
                  agBk={formData.agBk}
                  sealingType={formData.sealingType}
                  stage={confirmedPump.stage}
                />
              );
            })()}

            <Section title="General Information" items={generalInfoItems} />
            <Section title="Fluid Properties" items={fluidPropertiesItems} />
            <Section title="Operating Conditions" items={operatingConditionsItems} />
            <Section title="MOC & Elastomer" items={mocItems} />
            <Section title="Sealing Details" items={sealingItems} />
            <Section title="Motor Rating" items={motorRatingItems} />

            {driveHasAnything && (
              <div className="mt-4 overflow-hidden rounded-lg border border-line bg-paper">
                <div className="border-b border-line bg-elev px-4 py-2.5">
                  <span className="section-label">Drive Details</span>
                </div>
                <div className="p-4">
                  <FieldGrid items={driveCommonItems} />

                  {hasAny(driveInputItems) && (
                    <div className={hasAny(driveCommonItems) ? "mt-4" : ""}>
                      <FieldGrid items={driveInputItems} />
                    </div>
                  )}

                  {hasAny(driveSelectedItems) && (
                    <div className="mt-4 rounded-md border-2 border-pos bg-[var(--pos-soft)] p-3">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-[var(--pos-strong)]">
                        Selected {isVBelt ? "V-Belt" : "Gearbox"} Option
                      </span>
                      <FieldGrid items={driveSelectedItems} tone="pos" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div className="step-actions">
          <button onClick={onPrevious}>Previous</button>

          <button disabled={!confirmedPump} onClick={() => setShowReport(true)}>
            View Test Report
          </button>

          <button
            disabled
            title="Not available yet — pump_selections/pump_recommendations aren't built in the database, so a selection can't be persisted or carried to the Selection Summary page."
          >
            Confirm Pump Selection
          </button>
        </div>

        <TestReportModal
          isOpen={showReport}
          onClose={() => setShowReport(false)}
          pump={confirmedPump}
        />
      </div>
    </div>
  );
};

export default RecommendationStep;
