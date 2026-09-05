"use client";

import { useEffect, useState } from "react";
import Stepper from "./Stepper";
import "./GeneralInformationStep.css";
import { actions, btnGhost, btnPrimary, control, fieldWrap, hint, label } from "./formStyles";
import { getMotorRating, type MotorRating } from "../../services/motorRatingService";
import { Err, ErrorBanner, Req } from "./fieldBits";

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
  }, [
    model,
    formData.capacity,
    formData.capacityUnit,
    formData.head,
    formData.headUnit,
    // ME / Min KW tested are read at the selected head, so a different head
    // for the same model must re-run the calculation.
    formData.selectedHead,
    formData.sg,
  ]);

  const hasKwOptions = (rating?.kwOptions.length ?? 0) > 0;

  // Trim the raw kwOptions list so the dropdown carries at most ONE sub-
  // recommended size (the one closest below `recommendedKw`) plus every size at
  // or above the recommendation. Full list is preserved on `rating.kwOptions`
  // for anything else that consumes it; only the dropdown is trimmed.
  const kwOptionsForDisplay = (() => {
    if (!rating) return [] as number[];
    const rec = rating.recommendedKw;
    if (rec == null) return rating.kwOptions;
    const below = rating.kwOptions.filter((k) => k < rec).slice(-1);
    const atOrAbove = rating.kwOptions.filter((k) => k >= rec);
    return [...below, ...atOrAbove];
  })();

  // The rating drives the whole drive step (motor options, v-belt and gearbox
  // screening), so it cannot be left blank. It is normally already filled from
  // the recommendation - this catches the case where it was cleared, or where
  // no standard ratings exist and it has to be typed in.
  const [showErrors, setShowErrors] = useState(false);
  const ratingError = (formData.driveMotorKw ?? "").toString().trim()
    ? ""
    : "Drive motor rating is required.";

  const handleNext = () => {
    if (ratingError) {
      setShowErrors(true);
      return;
    }
    onNext();
  };

  // Picking below the recommendation is allowed (the engineer may have a
  // reason) but it under-powers the duty, so it is called out rather than
  // silently accepted.
  const selectedKw = parseFloat(formData.driveMotorKw ?? "");
  const belowRecommended =
    rating?.recommendedKw != null &&
    Number.isFinite(selectedKw) &&
    selectedKw < rating.recommendedKw;

  return (
    <div className="step-container">
      <Stepper currentStep={6} maxStep={formData.wizardMaxStep} onStepClick={onStepClick} />

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
                BKW = Capacity × Head ÷ 367 ÷ (ME ÷ 100), at the entered duty head{" "}
                {round(rating.dutyHeadMwc)} MWC. ME ({rating.mechEff}%) is read at the
                selected head, {rating.headMwc} MWC. Recommendation = nearest standard
                motor KW ≥ Motor KW.
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
                <label className={label}>
                  Drive Motor Rating (KW)
                  <Req />
                </label>
                {hasKwOptions ? (
                  <select
                    className={control}
                    value={formData.driveMotorKw ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, driveMotorKw: e.target.value })
                    }
                  >
                    <option value="">Select KW</option>
                    {kwOptionsForDisplay.map((kw) => (
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
                <Err show={showErrors} msg={ratingError} />
                {belowRecommended && (
                  <div className="mt-[8px] rounded-lg border border-warn bg-[var(--warn-soft,#fff8e6)] pl-[12px] pr-[12px] pt-[10px] pb-[10px]">
                    <span className="block text-[12.5px] font-semibold text-warn">
                      Below the recommended rating
                    </span>
                    <p className="mt-[3px] text-[12px] leading-[1.5] text-fg-2">
                      {formData.driveMotorKw} kW is under the {rating.recommendedKw} kW this
                      duty calculates to (Motor KW{" "}
                      {rating.motorKw !== null ? round(rating.motorKw) : "—"}). The motor may
                      overload at the stated capacity and head &mdash; confirm the duty before
                      continuing.
                    </p>
                  </div>
                )}
                <span className={hint}>
                  {hasKwOptions
                    ? "Final selection is manual. Only the closest smaller size is offered below the recommended rating; every larger standard rating is above."
                    : "No standard KW ratings available — enter the motor KW manually."}
                </span>
              </div>
            </div>
          </>
        )}

        <ErrorBanner show={showErrors} count={ratingError ? 1 : 0} />

        <div className={actions}>
          <button className={btnGhost} onClick={onPrevious}>
            Previous
          </button>
          <button className={btnPrimary} onClick={handleNext}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default MotorRatingStep;
