"use client";

import { useEffect, useState } from "react";
import "./LivePumpRecommendation.css";
import { previewRecommendations } from "../../services/recommendationService";
import type { PumpRecommendation } from "../../data/Recommendations";
import { sizeForViscosityRange } from "../../lib/suction-discharge-size";
import { sealingShort } from "../../lib/sealing";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
};

type Status = "idle" | "loading" | "ready" | "empty" | "error";

// Only the fields the engine actually uses — re-query when any of these
// change, including selectedModel (a pick must be re-evaluated fresh).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const engineKey = (f: any) =>
  JSON.stringify({
    capacity: f.capacity,
    capacityUnit: f.capacityUnit,
    head: f.head,
    headUnit: f.headUnit,
    sg: f.sg,
    rpmRange: f.rpmRange,
    selectedModel: f.selectedModel,
  });

const LivePumpRecommendation = ({ formData, setFormData }: Props) => {
  const [recs, setRecs] = useState<PumpRecommendation[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const key = engineKey(formData);

  useEffect(() => {
    const cap = parseFloat(formData.capacity);
    const head = parseFloat(formData.head);
    if (!(cap > 0) || !(head > 0)) {
      setStatus("idle");
      setRecs([]);
      return;
    }

    const controller = new AbortController();
    // Debounce so typing doesn't fire a request per keystroke.
    const timer = setTimeout(() => {
      setStatus("loading");
      previewRecommendations(formData, controller.signal)
        .then((res) => {
          setRecs(res.recommendations);
          setStatus(res.recommendations.length ? "ready" : "empty");
        })
        .catch((err) => {
          if (controller.signal.aborted || err?.code === "ERR_CANCELED") return;
          setStatus("error");
        });
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const selectPump = (model: string) => {
    // Clicking the already-selected card deselects it.
    setFormData({
      ...formData,
      selectedModel: formData.selectedModel === model ? "" : model,
    });
  };

  // Step-5 Suction & Discharge Size — a single value from the viscosity range
  // (same for every model), shown on the card so it's always reflected. Null
  // until the viscosity (hence range) is entered on the Fluid Properties step.
  const size = sizeForViscosityRange(formData.viscosityRange);
  const seal = sealingShort(formData.sealingType);

  return (
    <div className="live-rec">
      <div className="live-rec-head">
        <span className="section-label">Live Recommendation</span>
        {status === "loading" && <span className="live-rec-status">Updating…</span>}
        {status === "ready" && <span className="live-dot" title="Live" />}
      </div>

      {status === "idle" && (
        <p className="live-rec-hint">
          Enter <strong>capacity</strong> and <strong>head</strong> to see live pump
          matches — they refine as you continue. Click a pump below to pin it as your
          pick; it&apos;ll keep being re-checked against every step from here on.
        </p>
      )}

      {status === "error" && (
        <p className="live-rec-hint">Couldn&apos;t update — check your connection.</p>
      )}

      {status === "empty" && (
        <p className="live-rec-hint">
          No model in the master data can reach this head at this capacity. Try
          adjusting capacity or head.
        </p>
      )}

      {recs.length > 0 && (
        <p className="live-rec-hint">
          {recs.length} matching {recs.length === 1 ? "model" : "models"} — click one to
          pin it as your pick.
        </p>
      )}

      {(status === "ready" || (status === "loading" && recs.length > 0)) &&
        recs.length > 0 && (
          <div className="live-rec-cards">
            {recs.map((r) => {
              const isSelected = Boolean(r.isSelected);
              return (
                <button
                  type="button"
                  key={r.id}
                  className={`live-rec-card${isSelected ? " is-selected" : ""}`}
                  onClick={() => selectPump(r.model)}
                  aria-pressed={isSelected}
                >
                  <div className="live-rec-card-badges">
                    {isSelected && <span className="live-rec-badge picked">Your Pick</span>}
                    {!r.isTested && <span className="live-rec-badge warn">Not Tested</span>}
                  </div>
                  <strong className="live-rec-card-model">{r.model}</strong>
                  <div className="live-rec-card-meta">
                    <div>
                      <span>RPM</span>
                      <b className="mono">{r.rpmRange}</b>
                    </div>
                    <div>
                      <span>VOLE</span>
                      <b className="mono">
                        {r.voleMin}–{r.voleMax}%
                      </b>
                    </div>
                    <div>
                      <span>Mech Eff</span>
                      <b className="mono">{r.mechEff}%</b>
                    </div>
                    <div>
                      <span>Size</span>
                      <b className="mono">{size !== null ? size : "—"}</b>
                    </div>
                  </div>
                  {/* Spec selections (same for every model), combined into one
                      line like "Vertical · BK · MS" — Pump Type · AG/BK · Seal.
                      Each part appears as it's chosen on its step. */}
                  {(formData.pumpType || formData.agBk || seal) && (
                    <span className="live-rec-card-type">
                      {[formData.pumpType, formData.agBk, seal]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  <span className="live-rec-card-action">
                    {isSelected ? "Click to unpin" : "Click to pin this pump"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
};

export default LivePumpRecommendation;
