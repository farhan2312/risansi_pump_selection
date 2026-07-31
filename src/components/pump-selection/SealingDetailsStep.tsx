"use client";

import { useEffect, useState } from "react";
import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import { actions, btnGhost, btnPrimary, control, fieldWrap, grid, hint, label } from "./formStyles";
import { lookupMocRecommendation } from "../../services/mocRecommendationService";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  onStepClick?: (step: number) => void;
};

const sealTypeFullName = (code: string | null): string =>
  code === "MS" ? "Mechanical Seal (MS)" : code === "GD" ? "Gland Packing (GD)" : "";

const SealingDetailsStep = ({
  onNext,
  onPrevious,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  const [recommendedSealType, setRecommendedSealType] = useState<string | null>(null);
  const media = formData.media as string;

  useEffect(() => {
    if (!media) {
      setRecommendedSealType(null);
      return;
    }
    let cancelled = false;
    lookupMocRecommendation(media)
      .then((row) => {
        if (cancelled) return;
        const sealType = row?.sealType ?? null;
        setRecommendedSealType(sealType);
        // Default the Sealing Type select from the recommendation, once, if unset.
        if (sealType && !formData.sealingType) {
          setFormData((f: typeof formData) => ({
            ...f,
            sealingType: sealType === "MS" ? "Mechanical Seal" : "Gland Packing",
          }));
        }
      })
      .catch(() => {
        if (!cancelled) setRecommendedSealType(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media]);

  return (
    <div className="step-container">
      <Stepper currentStep={4} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Sealing Details</h2>
        <p>Select the sealing arrangement for this pump.</p>

        {recommendedSealType && (
          <p className={hint}>
            Recommended from the MOC reference data for{" "}
            <strong>{media}</strong>: {sealTypeFullName(recommendedSealType)}
          </p>
        )}

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
                  sealingSubType:
                    e.target.value === "Mechanical Seal"
                      ? formData.sealingSubType
                      : "",
                })
              }
            >
              <option value="">Select</option>
              <option value="Mechanical Seal">Mechanical Seal</option>
              <option value="Gland Packing">Gland Packing</option>
            </select>
          </div>

          {formData.sealingType === "Mechanical Seal" && (
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
                <option value="MSA">MSA</option>
                <option value="SCG">SCG</option>
                <option value="DCG">DCG</option>
                <option value="DCG">MSK</option>
              </select>
            </div>
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
