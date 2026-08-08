"use client";

import { useEffect, useState } from "react";
import Stepper from "./Stepper";
import "./GeneralInformationStep.css";
import { actions, btnGhost, btnPrimary, control } from "./formStyles";
import {
  getMocAiSuggestion,
  MOC_AI_ELASTOMERS,
  MOC_AI_MATERIALS,
  MOC_AI_PROVIDERS,
  type MocAiProvider,
  type MocComponentSuggestions,
} from "../../services/mocRecommendationService";
import { downloadMocReportPdf } from "../../lib/moc-pdf-report";

// Renders the AI's markdown-formatted summary/alternatives/seal-rationale
// text (headers, "-"/"1." lists, **bold**) in the UI panel — a small,
// purpose-built subset matching what the prompt asks the model for, not a
// full markdown parser. Same subset the PDF export renders, so the on-screen
// panel and the downloaded report read the same way.
const renderInline = (text: string) =>
  text.split(/(\*\*.+?\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );

const MarkdownLite = ({ text, className = "" }: { text: string; className?: string }) => {
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    const items = listItems;
    blocks.push(
      listOrdered ? (
        <ol key={key} className="list-decimal space-y-0.5 pl-5">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key} className="list-disc space-y-0.5 pl-5">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      )
    );
    listItems = [];
  };

  (text || "").split("\n").forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      flushList(`list-${idx}`);
      return;
    }
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      flushList(`list-${idx}`);
      blocks.push(
        <div key={idx} className="mt-2 font-semibold first:mt-0">
          {renderInline(heading[1])}
        </div>
      );
    } else if (bullet || numbered) {
      const ordered = !!numbered;
      if (listItems.length > 0 && listOrdered !== ordered) flushList(`list-${idx}`);
      listOrdered = ordered;
      listItems.push((bullet ?? numbered)![1]);
    } else {
      flushList(`list-${idx}`);
      blocks.push(
        <p key={idx} className="mt-1 first:mt-0">
          {renderInline(line)}
        </p>
      );
    }
  });
  flushList("list-end");

  return <div className={className}>{blocks}</div>;
};

type Props = {
  onNext: () => void;
  onPrevious: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  onStepClick?: (step: number) => void;
};

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
  const media = formData.media as string;

  // AI-assisted per-component suggestion — advisory only, opt-in via button
  // click (not fetched automatically). Reset whenever the media changes so a
  // stale suggestion for a previous media can't linger.
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiSuggestion, setAiSuggestion] =
    useState<MocComponentSuggestions | null>(null);
  // Which LLM generates the recommendation — user-selectable per request,
  // defaults to Gemini (the provider that's been configured the longest).
  const [aiProvider, setAiProvider] = useState<MocAiProvider>("gemini");
  // Provider that actually produced the currently-shown aiSuggestion — kept
  // separate from aiProvider so flipping the dropdown before regenerating
  // doesn't retroactively relabel an already-fetched result.
  const [resultProvider, setResultProvider] = useState<MocAiProvider>("gemini");
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
    const providerAtRequest = aiProvider;
    getMocAiSuggestion({
      media,
      head: formData.head || undefined,
      headUnit: formData.headUnit || undefined,
      ph: formData.ph || undefined,
      temperatureC: formData.temperature || undefined,
      viscosityCp: formData.viscosityCp || undefined,
      sg: formData.sg || undefined,
      capacity: formData.capacity || undefined,
      capacityUnit: formData.capacityUnit || undefined,
      solidPct: formData.solidPercentage || undefined,
      solidSize: formData.solidSize || undefined,
      solidType: formData.solidType || undefined,
      provider: aiProvider,
    })
      .then((suggestion) => {
        if (suggestion) {
          setAiSuggestion(suggestion);
          setResultProvider(providerAtRequest);
          setAiStatus("ready");
        } else {
          setAiStatus("unavailable");
        }
      })
      .catch(() => setAiStatus("error"));
  };

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const handleDownloadPdf = async () => {
    if (!aiSuggestion) return;
    setPdfGenerating(true);
    setPdfError(false);
    try {
      const components = [...NON_WETTABLE_ROWS, ...WETTABLE_ROWS, ...ELASTOMER_ROWS].map(
        (row) => ({
          label: row.label,
          aiPick: aiSuggestion[row.aiKey],
        }),
      );
      await downloadMocReportPdf({
        media,
        head: formData.head || undefined,
        headUnit: formData.headUnit || undefined,
        ph: formData.ph || undefined,
        temperatureC: formData.temperature || undefined,
        viscosityCp: formData.viscosityCp || undefined,
        sg: formData.sg || undefined,
        capacity: formData.capacity || undefined,
        capacityUnit: formData.capacityUnit || undefined,
        solidPct: formData.solidPercentage || undefined,
        solidSize: formData.solidSize || undefined,
        solidType: formData.solidType || undefined,
        suggestion: aiSuggestion,
        components,
      });
    } catch {
      setPdfError(true);
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <div className="step-container">
      <Stepper currentStep={4} onStepClick={onStepClick} />

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

        {!media && (
          <p className="mt-4 text-[13px] text-fg-3">
            Select a media on the General Information step to continue.
          </p>
        )}

        {media && (
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={aiProvider}
                  disabled={aiStatus === "loading"}
                  onChange={(e) => setAiProvider(e.target.value as MocAiProvider)}
                  aria-label="AI model"
                  className="rounded-lg border border-line-strong bg-paper px-3 py-2.5 text-sm font-medium text-fg outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {MOC_AI_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={aiStatus === "loading"}
                  onClick={requestAiSuggestion}
                  className={`
    inline-flex items-center justify-center gap-2
    rounded-lg px-5 py-2.5
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
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                        🤖
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          AI Material Recommendation
                        </h3>
                        <p className="text-xs text-slate-500">
                          Generated by{" "}
                          {MOC_AI_PROVIDERS.find((p) => p.value === resultProvider)?.label ??
                            resultProvider}{" "}
                          based on the provided process conditions
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={pdfGenerating}
                      onClick={handleDownloadPdf}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-[13px] font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>📄</span>
                      {pdfGenerating ? "Preparing PDF…" : "Download PDF Report"}
                    </button>
                  </div>

                  {/* Content */}
                  <div className="space-y-4 p-4">
                    {pdfError && (
                      <p className="text-[12px] text-warn">
                        Couldn&apos;t generate the PDF — try again.
                      </p>
                    )}

                    {/* The detailed summary, material tables, and alternatives
                        live in the downloadable PDF report only — not shown
                        inline here to keep the form focused on selection. */}
                    <p className="text-[13px] text-slate-600">
                      A recommendation is ready. Download the PDF report for the
                      full engineering summary, material breakdown, and
                      alternatives.
                    </p>

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
                  {aiSuggestion.sealRationale && (
                    <MarkdownLite text={aiSuggestion.sealRationale} className="mt-1 text-[12px] text-emerald-900" />
                  )}
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
