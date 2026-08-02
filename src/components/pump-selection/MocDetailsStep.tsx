"use client";

import { useEffect, useState } from "react";
import Stepper from "./Stepper";
import "./GeneralInformationStep.css";
import { actions, btnGhost, btnPrimary, control, fieldWrap, grid, hint, label } from "./formStyles";
import {
  lookupMocRecommendation,
  type MocRecommendationRow,
} from "../../services/mocRecommendationService";
import {
  lookupMocNomenclature,
  type MocNomenclatureRow,
} from "../../services/mocNomenclatureService";

// The 3-letter MOC prefix and 1-letter rubber suffix values actually used
// across every recommended_moc / min_acceptable_moc code in moc_recommendation
// (verified against the live table — 6 prefixes x 5 suffixes).
const MOC_CODES = ["AAA", "AAB", "ABB", "BBB", "CCC", "XXX"];
const RUBBER_CODES: { value: string; label: string }[] = [
  { value: "N", label: "N - Nitrile" },
  { value: "E", label: "E - EPDM" },
  { value: "V", label: "V - Viton" },
  { value: "F", label: "F - Food Grade Nitrile" },
  { value: "X", label: "X - Other" },
];

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

// Human-readable label pairs for the 11 metal-component columns in
// moc_nomenclature — order matches the source MOC_D.xlsx sheet.
const NOMENCLATURE_FIELDS: { key: keyof MocNomenclatureRow; label: string }[] = [
  { key: "pumpHousing", label: "Pump Housing" },
  { key: "shaft", label: "Shaft" },
  { key: "rotor", label: "Rotor" },
  { key: "cRod", label: "C. Rod" },
  { key: "shd", label: "SHD" },
  { key: "slv", label: "SLV" },
  { key: "bush", label: "Bush" },
  { key: "hPin", label: "H. Pin" },
  { key: "pin", label: "Pin" },
  { key: "protector", label: "Protector" },
  { key: "holder", label: "Holder" },
];

const MocDetailsStep = ({ onNext, onPrevious, formData, setFormData, onStepClick }: Props) => {
  const [status, setStatus] = useState<Status>("idle");
  const [rec, setRec] = useState<MocRecommendationRow | null>(null);
  const [nom, setNom] = useState<MocNomenclatureRow | null>(null);
  const media = formData.media as string;
  const finalCode = formData.mocFinalCode as string | undefined;

  // Fetch nomenclature (material breakdown) whenever the final 4-letter code
  // is complete. Runs independently of the media lookup — the two are
  // orthogonal (recommendation vs decomposition).
  useEffect(() => {
    if (!finalCode || finalCode.length !== 4) {
      setNom(null);
      return;
    }
    let cancelled = false;
    lookupMocNomenclature(finalCode)
      .then((row) => {
        if (!cancelled) setNom(row);
      })
      .catch(() => {
        if (!cancelled) setNom(null);
      });
    return () => {
      cancelled = true;
    };
  }, [finalCode]);

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
        setFormData((f: typeof formData) => {
          const recommended = row?.recommendedMoc ?? "";
          // Default the manual selectors from the recommendation, once, if unset.
          const mocCode = f.mocCode ? f.mocCode : recommended.slice(0, 3);
          const mocRubberCode = f.mocRubberCode ? f.mocRubberCode : recommended.slice(3, 4);
          return {
            ...f,
            mocRecommendedMoc: recommended,
            mocMinAcceptableMoc: row?.minAcceptableMoc ?? "",
            mocElastomer: row?.elastomer ?? "",
            mocCode,
            mocRubberCode,
            mocFinalCode: f.mocFinalCode ? f.mocFinalCode : `${mocCode}${mocRubberCode}`,
          };
        });
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

        {(status === "ready" || status === "not-found") && (
          <div className="mt-4 rounded-md border border-line bg-elev p-4">
            <span className="section-label">Final MOC Selection (Manual)</span>
            <div className={`${grid} mt-2`}>
              <div className={fieldWrap}>
                <label className={label}>MOC</label>
                <select
                  className={control}
                  value={formData.mocCode ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      mocCode: e.target.value,
                      mocFinalCode: `${e.target.value}${formData.mocRubberCode ?? ""}`,
                    })
                  }
                >
                  <option value="">Select MOC</option>
                  {MOC_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldWrap}>
                <label className={label}>Stator Rubber</label>
                <select
                  className={control}
                  value={formData.mocRubberCode ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      mocRubberCode: e.target.value,
                      mocFinalCode: `${formData.mocCode ?? ""}${e.target.value}`,
                    })
                  }
                >
                  <option value="">Select Rubber</option>
                  {RUBBER_CODES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <span className={hint}>
              Final code:{" "}
              <b className="mono text-fg-2">{formData.mocFinalCode || "—"}</b>
            </span>
          </div>
        )}

        {nom && (
          <div className="mt-4 rounded-md border border-line bg-elev p-4">
            <div className="flex items-baseline gap-3">
              <span className="section-label">MOC Details</span>
              <span className="mono text-[14px] font-semibold text-fg">
                {nom.mocCode}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {NOMENCLATURE_FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-wide text-fg-3">
                    {f.label}
                  </span>
                  <strong className="text-[13px] text-fg">
                    {nom[f.key] as string}
                  </strong>
                </div>
              ))}
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-wide text-fg-3">
                  Stator + Rubber
                </span>
                <strong className="text-[13px] text-fg">{nom.statorRubber}</strong>
              </div>
            </div>
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
