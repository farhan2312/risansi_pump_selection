"use client";

import { useEffect, useState } from "react";
import Stepper from "./Stepper";
import "./GeneralInformationStep.css";
import { actions, btnGhost, btnPrimary, control, fieldWrap, hint, label } from "./formStyles";
import { getMotorRating, type MotorRating } from "../../services/motorRatingService";

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  onStepClick?: (step: number) => void;
};

type Status = "idle" | "loading" | "ready" | "error";

const round = (n: number, dp = 3): string => String(Math.round(n * 10 ** dp) / 10 ** dp);

const MotorRatingStep = ({ onNext, onPrevious, formData, setFormData, onStepClick }: Props) => {
  const [status, setStatus] = useState<Status>("idle");
  const [rating, setRating] = useState<MotorRating | null>(null);
  const model = formData.selectedModel as string;

  useEffect(() => {
    if (!model) {
      setStatus("idle");
      setRating(null);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    getMotorRating(formData)
      .then((r) => {
        if (cancelled) return;
        setRating(r);
        setStatus("ready");
        // Default the Drive Motor Rating to the recommendation, once, if unset.
        setFormData((f: typeof formData) => {
          if (f.driveMotorKw) return f;
          return { ...f, driveMotorKw: r.recommendedKw !== null ? String(r.recommendedKw) : "" };
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, formData.capacity, formData.capacityUnit, formData.head, formData.headUnit, formData.sg]);

  const hasKwOptions = (rating?.kwOptions.length ?? 0) > 0;

  return (
    <div className="step-container">
      <Stepper currentStep={6} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Motor Rating (KW)</h2>
        <p>
          Calculated from the confirmed pump model
          {model ? (
            <>
              {" "}
              (<strong>{model}</strong>)
            </>
          ) : null}{" "}
          and the duty point. Pick the final drive motor rating below.
        </p>

        {status === "idle" && (
          <p className="mt-4 text-[13px] text-fg-3">
            Confirm a pump model first to calculate the motor rating.
          </p>
        )}
        {status === "loading" && (
          <p className="mt-4 text-[13px] text-fg-3">Calculating motor rating…</p>
        )}
        {status === "error" && (
          <p className="mt-4 text-[13px] text-warn">
            Couldn&apos;t calculate the motor rating — check your connection and try again.
          </p>
        )}

        {status === "ready" && rating && (
          <>
            <div className="mt-4 rounded-md border border-line bg-elev p-4">
              <span className="section-label">Calculation</span>
              <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <span className="section-label">Mech. Efficiency</span>
                  <div className="mono text-[16px] font-semibold text-fg">
                    {rating.mechEff}%
                  </div>
                </div>
                <div>
                  <span className="section-label">BKW</span>
                  <div className="mono text-[16px] font-semibold text-fg">
                    {rating.bkw !== null ? round(rating.bkw) : "—"}
                  </div>
                </div>
                <div>
                  <span className="section-label">Motor KW (×1.2)</span>
                  <div className="mono text-[16px] font-semibold text-fg">
                    {rating.motorKw !== null ? round(rating.motorKw) : "—"}
                  </div>
                </div>
                <div>
                  <span className="section-label">Recommended KW</span>
                  <div className="mono text-[20px] font-semibold text-fg">
                    {rating.recommendedKw !== null ? rating.recommendedKw : "—"}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-fg-3">
                BKW = Capacity × Head ÷ 367 ÷ (ME ÷ 100), at nearest charted head{" "}
                {rating.headMwc} MWC. Recommendation = nearest standard motor KW ≥ Motor KW
                {rating.minKwTested !== null
                  ? `, within Min KW tested (${rating.minKwTested}).`
                  : "."}
              </p>
              {rating.exceedsMinTested && (
                <p className="mt-2 text-[12px] text-warn">
                  Recommended {rating.recommendedKw} kW exceeds this model&apos;s Min KW so
                  far tested ({rating.minKwTested}) — the duty needs this power, but it&apos;s
                  beyond the tested range; verify before finalizing.
                </p>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className={fieldWrap}>
                <label className={label}>Drive Motor Rating (KW)</label>
                {hasKwOptions ? (
                  <select
                    className={control}
                    value={formData.driveMotorKw ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, driveMotorKw: e.target.value })
                    }
                  >
                    <option value="">Select KW</option>
                    {rating.kwOptions.map((kw) => (
                      <option key={kw} value={String(kw)}>
                        {kw}
                        {rating.recommendedKw === kw ? " (recommended)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    step="any"
                    className={control}
                    placeholder="Enter motor KW"
                    value={formData.driveMotorKw ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, driveMotorKw: e.target.value })
                    }
                  />
                )}
                <span className={hint}>
                  {hasKwOptions
                    ? "Final selection is manual — every standard KW rating above Motor KW."
                    : "No standard KW rating above Motor KW for this duty — enter the motor KW manually."}
                </span>
              </div>
            </div>
          </>
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

export default MotorRatingStep;
