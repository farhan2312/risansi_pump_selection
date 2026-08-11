"use client";

import { useEffect, useState } from "react";
import "./LivePumpRecommendation.css";
import { previewRecommendations } from "../../services/recommendationService";
import { saveWizardInput } from "../../services/wizardInputService";
import type { PumpRecommendation } from "../../data/Recommendations";
import { SIZE_COLUMN_BY_RANGE, sizeForViscosityRange } from "../../lib/suction-discharge-size";
import { sealingShort } from "../../lib/sealing";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  /** Open project's id — lets a model confirmation persist to general_info
   * immediately, from whichever step the panel is shown on. */
  projectId?: string;
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
    solidSize: f.solidSize,
    solidType: f.solidType,
  });

const LivePumpRecommendation = ({ formData, setFormData, projectId }: Props) => {
  const [recs, setRecs] = useState<PumpRecommendation[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  // Local "re-pick" mode: after a model is confirmed, "Change model" re-opens
  // the full list without dropping the confirmation (so step navigation stays
  // unlocked while the user swaps their pick).
  const [editing, setEditing] = useState(false);
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

  const confirmed = Boolean(formData.modelConfirmed);
  const confirmedRec =
    recs.find((r) => r.model === formData.selectedModel) ?? null;
  const hasConfirmedRec = confirmedRec !== null;

  // If a confirmed model stops matching the inputs (e.g. capacity/head edited
  // on a later visit to step 1), drop the confirmation so the user must pick
  // again — this also re-locks step navigation past the Fluid step.
  useEffect(() => {
    if (confirmed && status === "ready" && formData.selectedModel && !hasConfirmedRec) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFormData((f: any) => ({ ...f, modelConfirmed: false }));
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed, status, formData.selectedModel, hasConfirmedRec]);

  const selectPump = (model: string) => {
    // Clicking the already-selected card deselects it.
    setFormData({
      ...formData,
      selectedModel: formData.selectedModel === model ? "" : model,
    });
  };

  const confirmModel = () => {
    setFormData({ ...formData, modelConfirmed: true });
    setEditing(false);
    // Persist the pick to general_info right away — the panel can be confirmed
    // from any step, so we can't rely on leaving step 1 to save it.
    if (projectId) {
      saveWizardInput("general-info", projectId, {
        selectedModel: formData.selectedModel,
        modelConfirmed: true,
      }).catch(() => {
        // Best-effort — the in-memory formData still gates navigation; the
        // step-1 save will pick it up as a fallback.
      });
    }
  };

  const changeModel = () => setEditing(true);

  // Per-model suction/discharge pipe size — looked up from the pump's own
  // pump_model_master.size_visc_* column matching the chosen viscosity range.
  // Falls back to the flat SIZE_BY_RANGE hint when the model isn't covered
  // by Model_vs_Viscosity_vs_Size.xlsx (mostly L-variants).
  const fallbackSize = sizeForViscosityRange(formData.viscosityRange);
  const perModelSize = (r: PumpRecommendation): number | null => {
    const col = SIZE_COLUMN_BY_RANGE[formData.viscosityRange as string];
    if (!col) return null;
    const v = r[col];
    return v ?? fallbackSize;
  };
  const seal = sealingShort(formData.sealingType);

  const cardInner = (r: PumpRecommendation, showAction: boolean, confirmedBadge: boolean) => {
    const isSelected = r.model === formData.selectedModel;
    const size = perModelSize(r);
    return (
      <>
        <div className="live-rec-card-badges">
          {confirmedBadge && <span className="live-rec-badge confirmed">Confirmed</span>}
          {!confirmedBadge && isSelected && (
            <span className="live-rec-badge picked">Your Pick</span>
          )}
          {!r.isTested && <span className="live-rec-badge warn">Not Tested</span>}
        </div>
        <strong className="live-rec-card-model">{r.model}</strong>
        <div className="live-rec-card-meta">
          <div>
            <span>Stage</span>
            <b className="mono">{r.stage ?? "—"}</b>
          </div>
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
            <b className="mono">{size !== null ? `${size}"` : "—"}</b>
          </div>
        </div>
        {/* Spec selections (same for every model), combined into one line like
            "Vertical · BK · MS" — Pump Type · AG/BK · Seal. Each part appears
            as it's chosen on its step. */}
        {(formData.pumpType || formData.agBk || seal) && (
          <span className="live-rec-card-type">
            {[formData.pumpType, formData.agBk, seal]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
        {showAction && (
          <span className="live-rec-card-action">
            {isSelected ? "Click to unpin" : "Click to pin this pump"}
          </span>
        )}
      </>
    );
  };

  const confirmedView = confirmed && !editing && hasConfirmedRec;

  return (
    <div className="live-rec">
      <div className="live-rec-head">
        <span className="section-label">
          {confirmedView ? "Selected Pump" : "Live Recommendation"}
        </span>
        {status === "loading" && <span className="live-rec-status">Updating…</span>}
        {status === "ready" && <span className="live-dot" title="Live" />}
      </div>

      {status === "idle" && !confirmedView && (
        <p className="live-rec-hint">
          Enter <strong>capacity</strong> and <strong>head</strong> to see live pump
          matches. After the Fluid step you&apos;ll pick one and confirm it to continue.
        </p>
      )}

      {status === "error" && (
        <p className="live-rec-hint">Couldn&apos;t update — check your connection.</p>
      )}

      {status === "empty" && !confirmedView && (
        <p className="live-rec-hint">
          No model in the master data can reach this head at this capacity. Try
          adjusting capacity or head.
        </p>
      )}

      {confirmedView && confirmedRec ? (
        <>
          <p className="live-rec-hint">
            Model confirmed — the rest of the wizard is configured for this pump.
          </p>
          <div className="live-rec-cards live-rec-cards--single">
            <div className="live-rec-card is-locked">
              {cardInner(confirmedRec, false, true)}
            </div>
          </div>
          <button type="button" className="live-rec-change" onClick={changeModel}>
            Change model
          </button>
        </>
      ) : (
        <>
          {recs.length > 0 && (
            <p className="live-rec-hint">
              {recs.length} matching {recs.length === 1 ? "model" : "models"} — click one,
              then confirm it to continue.
            </p>
          )}

          {(status === "ready" || (status === "loading" && recs.length > 0)) &&
            recs.length > 0 && (
              <div className="live-rec-cards">
                {recs.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    className={`live-rec-card${r.model === formData.selectedModel ? " is-selected" : ""}`}
                    onClick={() => selectPump(r.model)}
                    aria-pressed={r.model === formData.selectedModel}
                  >
                    {cardInner(r, true, false)}
                  </button>
                ))}
              </div>
            )}

          {hasConfirmedRec && (
            <div className="live-rec-confirm-bar">
              <span>
                Confirm <strong>{formData.selectedModel}</strong> as your pump model?
              </span>
              <button type="button" className="live-rec-confirm-btn" onClick={confirmModel}>
                Confirm
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LivePumpRecommendation;
