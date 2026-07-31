"use client";

import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import PumpDetailsCard from "../../components/recommendation/PumpDetailsCard";
import TestReportModal from "../../components/recommendation/TestReportModal";
import { useEffect, useState } from "react";
import { getRecommendations } from "../../services/recommendationService";
import { sizeForViscosityRange } from "../../lib/suction-discharge-size";
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
    ["Recommended MOC", formData.mocRecommendedMoc],
    ["Min. Acceptable MOC", formData.mocMinAcceptableMoc],
    ["Elastomer", formData.mocElastomer],
    ["MOC (Selected)", formData.mocFinalCode],
    ["Drive Motor Rating", formData.driveMotorKw ? `${formData.driveMotorKw} kW` : ""],
    ["Drive System", formData.driveSystem],
    ["Motor Make", formData.motorMake],
    ["Gearbox Make", formData.gearboxMake],
    ["Motor RPM", formData.motorRPM],
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
            <PumpDetailsCard
              pump={confirmedPump}
              size={sizeForViscosityRange(formData.viscosityRange)}
              pumpType={formData.pumpType}
              agBk={formData.agBk}
              sealingType={formData.sealingType}
            />

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
