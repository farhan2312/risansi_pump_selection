"use client";

import { useEffect, useState } from "react";
import "./LivePumpRecommendation.css";
import { previewRecommendations } from "../../services/recommendationService";
import type { PumpRecommendation } from "../../data/Recommendations";

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
    media: f.media,
    sg: f.sg,
    viscosity: f.viscosity,
    viscosityUnit: f.viscosityUnit,
    solidPercentage: f.solidPercentage,
    temperature: f.temperature,
    bearingHousing: f.bearingHousing,
    suctionHousing: f.suctionHousing,
    jointType: f.jointType,
    driveSystem: f.driveSystem,
    sealingType: f.sealingType,
    motorRPM: f.motorRPM,
    rpmRange: f.rpmRange,
    selectedModel: f.selectedModel,
  });

const LivePumpRecommendation = ({ formData, setFormData }: Props) => {
  const [recs, setRecs] = useState<PumpRecommendation[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [pinFellOut, setPinFellOut] = useState(false);
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
      previewRecommendations(formData, controller.signal, 3)
        .then((res) => {
          setRecs(res.recommendations);
          setPinFellOut(Boolean(res.pinFellOut));
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

  const top = recs.slice(0, 3);

  const selectPump = (model: string) => {
    // Clicking the already-selected card deselects it, reverting to the
    // plain auto-ranked top 3.
    setFormData({
      ...formData,
      selectedModel: formData.selectedModel === model ? "" : model,
    });
  };

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
          No pump matches these inputs yet. Try adjusting capacity, head, or viscosity.
        </p>
      )}

      {pinFellOut && (
        <p className="live-rec-hint live-rec-warn">
          Your previously picked pump no longer fits these inputs — showing the current
          best options instead.
        </p>
      )}

      {(status === "ready" || (status === "loading" && top.length > 0)) &&
        top.length > 0 && (
          <div className="live-rec-cards">
            {top.map((r, i) => {
              const isSelected = Boolean(r.isSelected);
              const isBest = i === 0;
              return (
                <button
                  type="button"
                  key={r.id}
                  className={`live-rec-card${isSelected ? " is-selected" : ""}`}
                  onClick={() => selectPump(r.model)}
                  aria-pressed={isSelected}
                >
                  <div className="live-rec-card-badges">
                    {isBest && <span className="live-rec-badge best">Best Match</span>}
                    {isSelected && <span className="live-rec-badge picked">Your Pick</span>}
                  </div>
                  <strong className="live-rec-card-model">{r.model}</strong>
                  <div className="live-rec-card-meta">
                    <div>
                      <span>RPM</span>
                      <b className="mono">{r.rpmRange ?? r.rpm}</b>
                    </div>
                    <div>
                      <span>Motor</span>
                      <b className="mono">{r.motor ?? "—"}</b>
                    </div>
                    <div>
                      <span>Match</span>
                      <b className="mono">{r.score}%</b>
                    </div>
                  </div>
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
