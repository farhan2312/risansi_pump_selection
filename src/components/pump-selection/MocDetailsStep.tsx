"use client";

import { useEffect, useState } from "react";
import Stepper from "./Stepper";
import "./GeneralInformationStep.css";
import { actions, btnGhost, btnPrimary } from "./formStyles";
import {
  lookupMocRecommendation,
  type MocRecommendationRow,
} from "../../services/mocRecommendationService";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  onStepClick?: (step: number) => void;
};

type Status = "idle" | "loading" | "ready" | "not-found" | "error";

const toNum = (v: string | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : parseFloat(v);

const MocDetailsStep = ({ onNext, onPrevious, formData, setFormData, onStepClick }: Props) => {
  const [status, setStatus] = useState<Status>("idle");
  const [rec, setRec] = useState<MocRecommendationRow | null>(null);
  const media = formData.media as string;

  useEffect(() => {
    if (!media) {
      setStatus("idle");
      setRec(null);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    lookupMocRecommendation(media)
      .then((row) => {
        if (cancelled) return;
        setRec(row);
        setStatus(row ? "ready" : "not-found");
        // Carry the recommendation into formData so the final summary step
        // can show it without re-fetching.
        setFormData((f: typeof formData) => ({
          ...f,
          mocRecommendedMoc: row?.recommendedMoc ?? "",
          mocMinAcceptableMoc: row?.minAcceptableMoc ?? "",
          mocElastomer: row?.elastomer ?? "",
        }));
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media]);

  const phValue = parseFloat(formData.ph);
  const tempValue = parseFloat(formData.temperature); // canonical Celsius
  const phMinNum = toNum(rec?.phMin);
  const phMaxNum = toNum(rec?.phMax);
  const tempMinNum = toNum(rec?.tempMin);
  const tempMaxNum = toNum(rec?.tempMax);

  const phOutOfRange =
    phMinNum !== null && phMaxNum !== null && !Number.isNaN(phValue)
      ? phValue < phMinNum || phValue > phMaxNum
      : false;
  const tempOutOfRange =
    tempMinNum !== null && tempMaxNum !== null && !Number.isNaN(tempValue)
      ? tempValue < tempMinNum || tempValue > tempMaxNum
      : false;

  return (
    <div className="step-container">
      <Stepper currentStep={5} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>MOC &amp; Elastomer</h2>
        <p>
          Recommended from the media, pH, and temperature entered earlier
          {media ? (
            <>
              {" "}
              for <strong>{media}</strong>
            </>
          ) : null}
          .
        </p>

        {status === "idle" && (
          <p className="mt-4 text-[13px] text-fg-3">
            Select a media on the General Information step to see a recommendation.
          </p>
        )}

        {status === "loading" && (
          <p className="mt-4 text-[13px] text-fg-3">Looking up MOC recommendation…</p>
        )}

        {status === "error" && (
          <p className="mt-4 text-[13px] text-warn">
            Couldn&apos;t load the MOC recommendation — check your connection and try again.
          </p>
        )}

        {status === "not-found" && (
          <p className="mt-4 text-[13px] text-warn">
            No MOC reference data found for &quot;{media}&quot; — this looks like a
            custom/manually-typed media. Select MOC and elastomer manually with
            engineering input.
          </p>
        )}

        {status === "ready" && rec && (
          <div className="mt-4 rounded-md border border-line bg-elev p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <span className="section-label">Recommended MOC</span>
                <div className="mono text-[20px] font-semibold text-fg">
                  {rec.recommendedMoc ?? "—"}
                </div>
              </div>
              <div>
                <span className="section-label">Min. Acceptable MOC</span>
                <div className="mono text-[20px] font-semibold text-fg">
                  {rec.minAcceptableMoc ?? "—"}
                </div>
              </div>
              <div>
                <span className="section-label">Elastomer</span>
                <div className="text-[16px] font-semibold text-fg">
                  {rec.elastomer ?? "—"}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-fg-3">
              <span>
                Reference pH: <b className="mono text-fg-2">{rec.phRaw ?? "—"}</b>
                {phOutOfRange && (
                  <span className="ml-1 text-warn">
                    (entered pH {formData.ph} is outside this range)
                  </span>
                )}
              </span>
              <span>
                Reference Temp:{" "}
                <b className="mono text-fg-2">
                  {rec.tempRaw ?? "—"} °C
                </b>
                {tempOutOfRange && (
                  <span className="ml-1 text-warn">
                    (entered temp {formData.temperature}°C is outside this range)
                  </span>
                )}
              </span>
              {rec.abrasive && (
                <span>
                  Abrasive: <b className="text-fg-2">{rec.abrasive}</b>
                </span>
              )}
              {rec.corrosive && (
                <span>
                  Corrosive: <b className="text-fg-2">{rec.corrosive}</b>
                </span>
              )}
            </div>

            {rec.remarks && <p className="mt-3 text-[12px] text-fg-3">{rec.remarks}</p>}

            {(phOutOfRange || tempOutOfRange) && (
              <p className="mt-3 text-[12px] text-warn">
                Site conditions differ from this reference row — verify MOC/elastomer
                suitability before finalizing.
              </p>
            )}
          </div>
        )}

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

export default MocDetailsStep;
