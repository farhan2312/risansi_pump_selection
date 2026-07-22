"use client";

import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import RecommendationTable from "../../components/recommendation/RecommendationTable";
import PumpDetailsCard from "../../components/recommendation/PumpDetailsCard";
import TestReportModal from "../../components/recommendation/TestReportModal";
import { useEffect, useState } from "react";
import { getRecommendations } from "../../services/recommendationService";
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

const RecommendationStep = ({
  onPrevious,
  formData,
  selectedPump,
  setSelectedPump,
  onStepClick,
}: Props) => {
  const [showReport, setShowReport] = useState(false);
  const [recommendations, setRecommendations] = useState<PumpRecommendation[]>(
    []
  );
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
            "Couldn't fetch pump recommendations. Please check your connection and try again."
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

  const selectedPumpData =
    recommendations.find((pump) => pump.id === selectedPump) || null;

  return (
    <div className="step-container">
      <Stepper currentStep={6} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Recommended Pumps</h2>

        <p>
          Every pump model that satisfies these inputs is listed below — pick the one
          you want.
          {inputEcho && (
            <>
              {" "}
              (Capacity: <strong>{inputEcho.capacity}</strong>, Head:{" "}
              <strong>{inputEcho.head}</strong>)
            </>
          )}
        </p>

        {isLoading && <p>Finding the pump matches...</p>}

        {error && <p className="error-message">{error}</p>}

        {!isLoading && !error && recommendations.length === 0 && (
          <p>
            No pumps matched these requirements. Try adjusting capacity, head, or
            viscosity.
          </p>
        )}

        {!isLoading && !error && recommendations.length > 0 && (
          <RecommendationTable
            recommendations={recommendations}
            selectedPump={selectedPump}
            setSelectedPump={setSelectedPump}
          />
        )}

        <PumpDetailsCard pump={selectedPumpData} />

        <div className="step-actions">
          <button onClick={onPrevious}>Previous</button>

          <button
            disabled={selectedPump === null}
            onClick={() => setShowReport(true)}
          >
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
          pump={selectedPumpData}
        />
      </div>
    </div>
  );
};

export default RecommendationStep;
