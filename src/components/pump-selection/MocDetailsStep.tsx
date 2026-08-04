"use client";

import { useEffect, useState } from "react";
import Stepper from "./Stepper";
import "./GeneralInformationStep.css";
import { actions, btnGhost, btnPrimary, control } from "./formStyles";
import {
  getMocAiSuggestion,
  lookupMocRecommendation,
  MOC_AI_ELASTOMERS,
  MOC_AI_MATERIALS,
  type MocComponentSuggestions,
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
type AiStatus = "idle" | "loading" | "ready" | "unavailable" | "error";

// Rotating status text shown on the button/panel while the AI request is in
// flight — the request genuinely takes a few seconds (the model "thinks"
// before answering), so a single static "Loading…" reads as stuck.
const AI_LOADING_MESSAGES = [
  "Reading media properties…",
  "Checking corrosion resistance…",
  "Weighing temperature & pH impact…",
  "Matching elastomer compatibility…",
  "Comparing material cost vs. durability…",
  "Finalizing recommendation…",
];

// Per-component AI-recommendation panel rows. `key` is the formData field
// prefix (paired with `${key}Remarks` for the open-remarks input); `aiKey`
// selects the matching field from the AI response.
type ComponentRow = {
  key: string;
  label: string;
  aiKey: keyof MocComponentSuggestions;
  options: readonly string[];
};

const NON_WETTABLE_ROWS: ComponentRow[] = [
  {
    key: "mocAiBearingHousing",
    label: "Bearing Housing",
    aiKey: "bearingHousing",
    options: MOC_AI_MATERIALS,
  },
  {
    key: "mocAiBearingPlate",
    label: "Bearing Plate",
    aiKey: "bearingPlate",
    options: MOC_AI_MATERIALS,
  },
  {
    key: "mocAiTieRod",
    label: "Tie Rod",
    aiKey: "tieRod",
    options: MOC_AI_MATERIALS,
  },
  {
    key: "mocAiNutBolt",
    label: "Nut & Bolt",
    aiKey: "nutBolt",
    options: MOC_AI_MATERIALS,
  },
];

const WETTABLE_ROWS: ComponentRow[] = [
  {
    key: "mocAiPumpHousing",
    label: "Pump Housing",
    aiKey: "pumpHousing",
    options: MOC_AI_MATERIALS,
  },
  {
    key: "mocAiRotor",
    label: "Rotor",
    aiKey: "rotor",
    options: MOC_AI_MATERIALS,
  },
  {
    key: "mocAiShaft",
    label: "Shaft",
    aiKey: "shaft",
    options: MOC_AI_MATERIALS,
  },
];

const ELASTOMER_ROWS: ComponentRow[] = [
  {
    key: "mocAiStatorRubber",
    label: "Stator Rubber Parts",
    aiKey: "statorRubber",
    options: MOC_AI_ELASTOMERS,
  },
];

const MocDetailsStep = ({
  onNext,
  onPrevious,
  formData,
  setFormData,
  onStepClick,
}: Props) => {
  const [status, setStatus] = useState<Status>("idle");
  const [rec, setRec] = useState<MocRecommendationRow | null>(null);
  const media = formData.media as string;

  // Curated-table lookup — no longer shown directly in the UI, but still
  // gates "not-found" vs "ready" and silently seeds mocCode/mocRubberCode
  // (used elsewhere, e.g. the final summary's "MOC (Selected)" line) once,
  // if unset.
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
        setFormData((f: typeof formData) => {
          const recommended = row?.recommendedMoc ?? "";
          const mocCode = f.mocCode ? f.mocCode : recommended.slice(0, 3);
          const mocRubberCode = f.mocRubberCode
            ? f.mocRubberCode
            : recommended.slice(3, 4);
          return {
            ...f,
            mocRecommendedMoc: recommended,
            mocMinAcceptableMoc: row?.minAcceptableMoc ?? "",
            mocElastomer: row?.elastomer ?? "",
            mocCode,
            mocRubberCode,
            mocFinalCode: f.mocFinalCode
              ? f.mocFinalCode
              : `${mocCode}${mocRubberCode}`,
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

  // AI-assisted per-component suggestion — advisory only, opt-in via button
  // click (not fetched automatically). Reset whenever the media changes so a
  // stale suggestion for a previous media can't linger.
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiSuggestion, setAiSuggestion] =
    useState<MocComponentSuggestions | null>(null);
  useEffect(() => {
    setAiStatus("idle");
    setAiSuggestion(null);
  }, [media]);

  // Cycles AI_LOADING_MESSAGES while a request is in flight.
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  useEffect(() => {
    if (aiStatus !== "loading") {
      setLoadingMsgIndex(0);
      return;
    }
    const id = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % AI_LOADING_MESSAGES.length);
    }, 1400);
    return () => clearInterval(id);
  }, [aiStatus]);

  const requestAiSuggestion = () => {
    if (!media) return;
    setAiStatus("loading");
    getMocAiSuggestion({
      media,
      ph: formData.ph || undefined,
      temperatureC: formData.temperature || undefined,
      viscosityCp: formData.viscosityCp || undefined,
      sg: formData.sg || undefined,
      capacity: formData.capacity || undefined,
      capacityUnit: formData.capacityUnit || undefined,
      solidPct: formData.solidPercentage || undefined,
      solidSize: formData.solidSize || undefined,
      solidType: formData.solidType || undefined,
    })
      .then((suggestion) => {
        if (suggestion) {
          setAiSuggestion(suggestion);
          setAiStatus("ready");
        } else {
          setAiStatus("unavailable");
        }
      })
      .catch(() => setAiStatus("error"));
  };

  return (
    <div className="step-container">
      <Stepper currentStep={5} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>MOC &amp; Elastomer</h2>
        <p>
          Select the material of construction and elastomer
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
            Select a media on the General Information step to see a
            recommendation.
          </p>
        )}

        {status === "loading" && (
          <p className="mt-4 text-[13px] text-fg-3">
            Looking up MOC recommendation…
          </p>
        )}

        {status === "error" && (
          <p className="mt-4 text-[13px] text-warn">
            Couldn&apos;t load the MOC recommendation — check your connection
            and try again.
          </p>
        )}

        {status === "not-found" && (
          <p className="mt-4 text-[13px] text-warn">
            No MOC reference data found for &quot;{media}&quot; — this looks
            like a custom/manually-typed media. Select MOC and elastomer
            manually with engineering input.
          </p>
        )}

        {(status === "ready" || status === "not-found") && (
          <div className="mt-4 rounded-md border border-line bg-elev p-4">
            <div className="mb-2 block text-[13px] font-semibold text-fg">
              <div>
                <span className="section-label">AI Recommendation</span>
                <span className="mt-1 text-[12px] text-fg-3">
                  Per-component material of construction, elastomer, and sealing
                  — from media, pH, temperature, viscosity, SG, flow rate, and
                  solids/particle size entered so far.
                </span>
              </div>
              <button
                type="button"
                disabled={aiStatus === "loading"}
                onClick={requestAiSuggestion}
                className={`
    inline-flex items-center justify-center gap-2
    rounded-lg px-5 py-2.5 mt-2
    text-sm font-semibold text-white
    bg-gradient-to-r from-emerald-600 to-green-500
    shadow-md transition-all duration-200
    hover:from-emerald-700 hover:to-green-600
    hover:shadow-lg hover:-translate-y-0.5
    active:translate-y-0
    disabled:cursor-not-allowed
    disabled:opacity-70
    disabled:hover:translate-y-0
    disabled:hover:shadow-md
  `}
              >
                {aiStatus === "loading" ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>

                    {AI_LOADING_MESSAGES[loadingMsgIndex]}
                  </>
                ) : (
                  <>
                    <span className="text-base">✨</span>

                    {aiStatus === "ready"
                      ? "Regenerate Recommendation"
                      : "Generate AI Recommendation"}
                  </>
                )}
              </button>
            </div>

            {aiStatus === "unavailable" && (
              <p className="mt-2 text-[12px] text-fg-3">
                AI recommendations aren&apos;t configured for this deployment.
              </p>
            )}
            {aiStatus === "error" && (
              <p className="mt-2 text-[12px] text-warn">
                Couldn&apos;t get an AI recommendation — check your connection
                and try again.
              </p>
            )}

            {aiStatus === "ready" && aiSuggestion && (
              <>
                <div className="mt-4 overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
                  {/* Header */}
                  <div className="flex items-center gap-2 border-b border-blue-100 px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                      🤖
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        AI Material Recommendation
                      </h3>
                      <p className="text-xs text-slate-500">
                        Generated based on the provided process conditions
                      </p>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-4 p-4">
                    {aiSuggestion.rationale ? (
                      <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 p-3">
                        <p className="text-sm text-emerald-900">
                          {aiSuggestion.rationale}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                        No recommendation generated yet.
                      </div>
                    )}

                    {/* Disclaimer */}
                    <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="text-lg">⚠️</div>

                      <div>
                        <p className="text-sm font-medium text-amber-900">
                          Engineering Review Required
                        </p>

                        <p className="mt-1 text-xs leading-5 text-amber-800">
                          This recommendation is AI-generated for guidance only.
                          Verify the selected materials against engineering
                          standards and customer specifications before approval.
                          Manual selections are not updated automatically.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 p-3">
                  <span className="section-label">Recommended Sealing</span>
                  <div className="mt-1 text-[14px] font-semibold text-fg">
                    {aiSuggestion.sealRecommendation || "—"}
                  </div>
                </div>
              </>
            )}

            <MocComponentTable
              title="Non-Wettable Components"
              rows={NON_WETTABLE_ROWS}
              ai={aiSuggestion}
              formData={formData}
              setFormData={setFormData}
            />
            <MocComponentTable
              title="Wettable Casting Components"
              rows={WETTABLE_ROWS}
              ai={aiSuggestion}
              formData={formData}
              setFormData={setFormData}
            />
            <MocComponentTable
              title="Elastomer"
              rows={ELASTOMER_ROWS}
              ai={aiSuggestion}
              formData={formData}
              setFormData={setFormData}
            />
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

// Renders one section of the AI-recommendation panel (Non-Wettable /
// Wettable Casting / Elastomer) as a small table: Component | AI
// Recommendation | Manual (dropdown) | Open Remarks (free text). Always
// rendered once a media is entered — the AI column just reads "—" until a
// suggestion has been fetched. The manual dropdown + remarks are independent
// formData fields; the AI value is informational only, never auto-applied.
const MocComponentTable = ({
  title,
  rows,
  ai,
  formData,
  setFormData,
}: {
  title: string;
  rows: ComponentRow[];
  ai: MocComponentSuggestions | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
}) => (
  <div className="mt-3">
    <span className="section-label">{title}</span>
    <div className="mt-1 overflow-x-auto rounded-md border border-line-strong">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-paper text-left text-[11px] uppercase tracking-wide text-fg-3">
            <th className="px-3 py-2">Component</th>
            <th className="px-3 py-2">AI Recommendation</th>
            <th className="px-3 py-2">Manual</th>
            <th className="px-3 py-2">Open Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const aiValue = ai ? ai[row.aiKey] : null;
            return (
              <tr key={row.key} className="border-t border-line">
                <td className="px-3 py-2 font-semibold text-fg">{row.label}</td>
                <td className="px-3 py-2">
                  {aiValue ? (
                    <span className="inline-block rounded-md border border-pos bg-[var(--pos-soft)] px-2 py-1 font-semibold text-[var(--pos-strong)]">
                      {aiValue}
                    </span>
                  ) : (
                    <span className="text-fg-3">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <select
                    className={control}
                    value={formData[row.key] ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, [row.key]: e.target.value })
                    }
                  >
                    <option value="">Select</option>
                    {row.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    className={control}
                    placeholder="Remarks"
                    value={formData[`${row.key}Remarks`] ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [`${row.key}Remarks`]: e.target.value,
                      })
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export default MocDetailsStep;
