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

  // Specs configured across the earlier steps (only the ones with a value).
  const configItems: [string, string | undefined][] = [
    ["Media / Application", formData.media],
    [
      "Viscosity",
      formData.viscosity
        ? `${formData.viscosity} ${formData.viscosityUnit || ""}`.trim()
        : "",
    ],
    ["Temperature", formData.temperature ? `${formData.temperature} °C` : ""],
    ["pH", formData.ph],
    ["Bearing Housing", formData.bearingHousing],
    ["Suction Housing", formData.suctionHousing],
    ["Joint Type", formData.jointType],
    ["Bearing Housing MOC", withRemarks(formData.mocAiBearingHousing, formData.mocAiBearingHousingRemarks)],
    ["Bearing Plate MOC", withRemarks(formData.mocAiBearingPlate, formData.mocAiBearingPlateRemarks)],
    ["Tie Rod MOC", withRemarks(formData.mocAiTieRod, formData.mocAiTieRodRemarks)],
    ["Nut & Bolt MOC", withRemarks(formData.mocAiNutBolt, formData.mocAiNutBoltRemarks)],
    ["Pump Housing MOC", withRemarks(formData.mocAiPumpHousing, formData.mocAiPumpHousingRemarks)],
    ["Rotor MOC", withRemarks(formData.mocAiRotor, formData.mocAiRotorRemarks)],
    ["Shaft MOC", withRemarks(formData.mocAiShaft, formData.mocAiShaftRemarks)],
    ["Stator Rubber", withRemarks(formData.mocAiStatorRubber, formData.mocAiStatorRubberRemarks)],
    ["Drive Motor Rating", formData.driveMotorKw ? `${formData.driveMotorKw} kW` : ""],
    ["Drive System", formData.driveSystem],
    ["Configuration", formData.gearedConfigType],
    ["Gear Box Shaft Type", formData.gearBoxType],
    ["GB Type", formData.gbConstructionType],
    ["Gear Box Mounting", formData.gearBoxMounting],
    ["Coupling", formData.driveCoupling],
    ["ASF Range", formData.asfRange],
    ["Gearbox Source", formData.gearboxSource],
    ["Gearbox Model", formData.gearboxModel],
    ["Gearbox Output RPM", formData.gearboxOutputRpm],
    ["Gearbox Service Factor", formData.gearboxServiceFactor],
    ["Gearbox Rate", formData.gearboxRatePerNos],
    ["V-Belt Groove", formData.driveVbeltGroove],
    ["Pump Pulley", formData.drivePumpPulley],
    ["Motor Pulley", formData.driveMotorPulley],
    ["V-Belt Pump RPM", formData.driveVbeltRpm],
    ["Centre Distance", formData.driveCenterDistance],
    ["V-Belt No.", formData.driveVbeltNo],
    ["Motor RPM", formData.motorRPM],
    ["Drive Motor Speed", formData.driveMotorSpeed ? `${formData.driveMotorSpeed} RPM` : ""],
    ["Drive Motor Make", formData.driveMotorMake],
    ["Motor Mounting", formData.driveMotorMounting],
    ["Motor Type", formData.driveMotorType],
    ["Starter Type", formData.driveStarterType],
    ["Power Supply", formData.drivePowerSupply],
    ["Std / Non-Std", formData.driveStdNonStd],
  ];
  const configured = configItems.filter(([, v]) => v && String(v).trim() !== "");

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

            {configured.length > 0 && (
              <div className="mt-4 rounded-md border border-line bg-elev p-4">
                <span className="section-label">Configuration</span>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {configured.map(([label, value]) => (
                    <div key={label} className="flex flex-col">
                      <span className="text-[11px] uppercase tracking-wide text-fg-3">
                        {label}
                      </span>
                      <strong className="text-fg">{value}</strong>
                    </div>
                  ))}
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
