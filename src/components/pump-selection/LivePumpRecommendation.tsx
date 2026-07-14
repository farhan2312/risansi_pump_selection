"use client";

import { useEffect, useState } from "react";
import "./LivePumpRecommendation.css";
import { previewRecommendations } from "../../services/recommendationService";
import type { PumpRecommendation } from "../../data/Recommendations";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
};

type Status = "idle" | "loading" | "ready" | "empty" | "error";

// Only the fields the engine actually uses — re-query when any of these change.
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
  });

const LivePumpRecommendation = ({ formData }: Props) => {
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

  const top = recs.slice(0, 3);
  const best = top[0];

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
          matches — they refine as you continue.
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

      {(status === "ready" || (status === "loading" && best)) && best && (
        <>
          <div className="live-rec-best">
            <div>
              <span className="live-rec-eyebrow">Best match</span>
              <strong className="live-rec-model">{best.model}</strong>
            </div>
            <div className="live-rec-best-meta">
              <div>
                <span>RPM</span>
                <b className="mono">{best.rpm}</b>
              </div>
              <div>
                <span>Motor</span>
                <b className="mono">{best.motor ?? "—"}</b>
              </div>
              <div>
                <span>Match</span>
                <b className="mono">{best.score}%</b>
              </div>
            </div>
          </div>

          {top.length > 1 && (
            <ul className="live-rec-list">
              {top.slice(1).map((r) => (
                <li key={r.id}>
                  <span className="live-rec-list-model">{r.model}</span>
                  <span className="mono live-rec-list-rpm">{r.rpm} rpm</span>
                  <span className="mono live-rec-list-score">{r.score}%</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default LivePumpRecommendation;
